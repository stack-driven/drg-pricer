import { inflateRawSync } from "node:zlib";

export type XlsxWorkbook = {
  readonly sheets: readonly XlsxSheet[];
};

export type XlsxSheet = {
  readonly name: string;
  readonly rows: readonly XlsxRow[];
};

export type XlsxRow = {
  readonly rowNumber: number;
  readonly cells: readonly string[];
};

type ZipEntry = {
  readonly name: string;
  readonly data: Buffer;
};

export function readXlsxWorkbook(input: Uint8Array): XlsxWorkbook {
  const entries = readZipEntries(input);
  const workbookXml = requiredTextEntry(entries, "xl/workbook.xml");
  const relationshipsXml = requiredTextEntry(entries, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(optionalTextEntry(entries, "xl/sharedStrings.xml") ?? "");
  const workbookRelationships = parseWorkbookRelationships(relationshipsXml);

  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/>/gu)].map((match) => {
    const attributes = match[1] ?? "";
    const name = xmlAttribute(attributes, "name") ?? "";
    const relationshipId = xmlAttribute(attributes, "r:id") ?? "";
    const target = workbookRelationships.get(relationshipId);
    if (target === undefined) {
      throw new Error(`XLSX workbook sheet ${name} is missing relationship ${relationshipId}`);
    }

    return {
      name,
      rows: parseWorksheetRows(requiredTextEntry(entries, resolveWorkbookTarget(target)), sharedStrings),
    };
  });

  return { sheets };
}

function readZipEntries(input: Uint8Array): ReadonlyMap<string, Buffer> {
  const buffer = Buffer.from(input);
  const endOfCentralDirectoryOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = readUInt16(buffer, endOfCentralDirectoryOffset + 10);
  const centralDirectoryOffset = readUInt32(buffer, endOfCentralDirectoryOffset + 16);
  const entries = new Map<string, Buffer>();

  let offset = centralDirectoryOffset;
  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    assertSignature(buffer, offset, 0x02014b50, "central directory file header");

    const generalPurposeFlag = readUInt16(buffer, offset + 8);
    if ((generalPurposeFlag & 0x0001) !== 0) {
      throw new Error("Encrypted XLSX entries are not supported");
    }

    const compressionMethod = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraFieldLength = readUInt16(buffer, offset + 30);
    const fileCommentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const fileName = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    entries.set(
      fileName,
      readZipEntry(buffer, {
        name: fileName,
        compressionMethod,
        compressedSize,
        localHeaderOffset,
      }).data,
    );

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function readZipEntry(
  buffer: Buffer,
  entry: {
    readonly name: string;
    readonly compressionMethod: number;
    readonly compressedSize: number;
    readonly localHeaderOffset: number;
  },
): ZipEntry {
  assertSignature(buffer, entry.localHeaderOffset, 0x04034b50, `local file header for ${entry.name}`);

  const fileNameLength = readUInt16(buffer, entry.localHeaderOffset + 26);
  const extraFieldLength = readUInt16(buffer, entry.localHeaderOffset + 28);
  const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const compressedData = buffer.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return { name: entry.name, data: compressedData };
  }

  if (entry.compressionMethod === 8) {
    return { name: entry.name, data: inflateRawSync(compressedData) };
  }

  throw new Error(`Unsupported XLSX ZIP compression method ${entry.compressionMethod} for ${entry.name}`);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - 65_558);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("Invalid XLSX file: missing ZIP end of central directory");
}

function assertSignature(buffer: Buffer, offset: number, signature: number, label: string): void {
  if (offset < 0 || offset + 4 > buffer.length || buffer.readUInt32LE(offset) !== signature) {
    throw new Error(`Invalid XLSX file: missing ${label}`);
  }
}

function readUInt16(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > buffer.length) {
    throw new Error("Invalid XLSX file: truncated ZIP structure");
  }
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > buffer.length) {
    throw new Error("Invalid XLSX file: truncated ZIP structure");
  }
  return buffer.readUInt32LE(offset);
}

function requiredTextEntry(entries: ReadonlyMap<string, Buffer>, name: string): string {
  const entry = optionalTextEntry(entries, name);
  if (entry === undefined) {
    throw new Error(`Invalid XLSX file: missing ${name}`);
  }
  return entry;
}

function optionalTextEntry(entries: ReadonlyMap<string, Buffer>, name: string): string | undefined {
  return entries.get(name)?.toString("utf8");
}

function parseWorkbookRelationships(input: string): ReadonlyMap<string, string> {
  const relationships = new Map<string, string>();

  for (const match of input.matchAll(/<Relationship\b([^>]*)\/>/gu)) {
    const attributes = match[1] ?? "";
    const id = xmlAttribute(attributes, "Id");
    const target = xmlAttribute(attributes, "Target");
    if (id !== undefined && target !== undefined) {
      relationships.set(id, target);
    }
  }

  return relationships;
}

function resolveWorkbookTarget(target: string): string {
  const normalizedTarget = target.replace(/^\/+/, "");
  if (normalizedTarget.startsWith("xl/")) {
    return normalizedTarget;
  }
  return `xl/${normalizedTarget}`;
}

function parseSharedStrings(input: string): readonly string[] {
  return [...input.matchAll(/<si>([\s\S]*?)<\/si>/gu)].map((match) =>
    parseRichText(match[1] ?? ""),
  );
}

function parseWorksheetRows(input: string, sharedStrings: readonly string[]): readonly XlsxRow[] {
  const rows: XlsxRow[] = [];

  for (const rowMatch of input.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gu)) {
    const rowAttributes = rowMatch[1] ?? "";
    const rowNumber = Number(xmlAttribute(rowAttributes, "r") ?? rows.length + 1);
    const cells: string[] = [];

    for (const cellMatch of (rowMatch[2] ?? "").matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gu)) {
      const cellAttributes = cellMatch[1] ?? "";
      const reference = xmlAttribute(cellAttributes, "r") ?? "";
      const cellIndex = columnIndex(reference);
      if (cellIndex === undefined) {
        continue;
      }

      cells[cellIndex] = parseCellValue(cellAttributes, cellMatch[2] ?? "", sharedStrings);
    }

    rows.push({ rowNumber, cells });
  }

  return rows;
}

function parseCellValue(
  attributes: string,
  body: string,
  sharedStrings: readonly string[],
): string {
  const type = xmlAttribute(attributes, "t");

  if (type === "inlineStr") {
    return parseRichText(body);
  }

  const rawValue = tagText(body, "v");
  if (rawValue === undefined) {
    return "";
  }

  if (type === "s") {
    const sharedString = sharedStrings[Number(rawValue)];
    return sharedString ?? "";
  }

  return decodeXmlText(rawValue);
}

function parseRichText(input: string): string {
  return [...input.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gu)]
    .map((match) => decodeXmlText(match[1] ?? ""))
    .join("");
}

function tagText(input: string, tagName: string): string | undefined {
  const match = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "u").exec(input);
  return match?.[1];
}

function columnIndex(reference: string): number | undefined {
  const match = /^[A-Z]+/u.exec(reference);
  if (match?.[0] === undefined) {
    return undefined;
  }

  let index = 0;
  for (const character of match[0]) {
    index = index * 26 + character.charCodeAt(0) - 64;
  }

  return index - 1;
}

function xmlAttribute(input: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`(?:^|\\s)${escapedName}="([^"]*)"`, "u").exec(input);
  return match?.[1] === undefined ? undefined : decodeXmlText(match[1]);
}

function decodeXmlText(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/gu, (_match, entity: string) => {
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default:
        if (entity.startsWith("#x")) {
          return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
        }
        if (entity.startsWith("#")) {
          return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
        }
        return `&${entity};`;
    }
  });
}
