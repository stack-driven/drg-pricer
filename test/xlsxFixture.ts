import { deflateRawSync } from "node:zlib";

export function makeSyntheticFallpauschalenXlsx(): Buffer {
  const sharedStrings = [
    "Fallpauschalen-Katalog und Pflegeerlöskatalog",
    "Teil a) Bewertungsrelationen bei Versorgung durch Hauptabteilungen",
    "DRG",
    "Parti- / tion",
    "Bezeichnung 6)",
    "Bewertungsrelation bei \r\nHauptabteilung",
    "Prä-MDC",
    "A01A",
    "Synthetic DRG A",
    "B79Z",
    "Synthetic DRG B",
    "960Z",
    "Nicht gruppierbar",
    "-",
  ];

  const sharedStringIndex = new Map(sharedStrings.map((value, index) => [value, index]));
  const shared = (value: string): number => {
    const index = sharedStringIndex.get(value);
    if (index === undefined) {
      throw new Error(`Missing shared string fixture value: ${value}`);
    }
    return index;
  };

  return createZip({
    "[Content_Types].xml": [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
      "</Types>",
    ].join(""),
    "_rels/.rels": [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
      "</Relationships>",
    ].join(""),
    "xl/workbook.xml": [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      "<sheets>",
      '<sheet name="Hauptabteilungen" sheetId="1" r:id="rId1"/>',
      "</sheets>",
      "</workbook>",
    ].join(""),
    "xl/_rels/workbook.xml.rels": [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
      "</Relationships>",
    ].join(""),
    "xl/sharedStrings.xml": [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">`,
      ...sharedStrings.map((value) => `<si><t>${xml(value)}</t></si>`),
      "</sst>",
    ].join(""),
    "xl/worksheets/sheet1.xml": [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheetData>",
      `<row r="2">${sCell("A2", shared("Fallpauschalen-Katalog und Pflegeerlöskatalog"))}</row>`,
      `<row r="3">${sCell("A3", shared("Teil a) Bewertungsrelationen bei Versorgung durch Hauptabteilungen"))}</row>`,
      `<row r="5">${sCell("A5", shared("DRG"))}${sCell("B5", shared("Parti- / tion"))}${sCell("C5", shared("Bezeichnung 6)"))}${sCell("D5", shared("Bewertungsrelation bei \r\nHauptabteilung"))}</row>`,
      `<row r="6">${nCell("A6", "1")}${nCell("B6", "2")}${nCell("C6", "3")}${nCell("D6", "4")}</row>`,
      `<row r="7">${sCell("A7", shared("Prä-MDC"))}</row>`,
      `<row r="8">${sCell("A8", shared("A01A"))}${sCell("C8", shared("Synthetic DRG A"))}${nCell("D8", "1.2340000000000002")}</row>`,
      `<row r="9">${sCell("A9", shared("B79Z"))}${sCell("C9", shared("Synthetic DRG B"))}${nCell("D9", "0.7000000000000001")}</row>`,
      `<row r="10">${sCell("A10", shared("960Z"))}${sCell("C10", shared("Nicht gruppierbar"))}${sCell("D10", shared("-"))}</row>`,
      "</sheetData>",
      "</worksheet>",
    ].join(""),
  });
}

function sCell(reference: string, sharedStringIndex: number): string {
  return `<c r="${reference}" t="s"><v>${sharedStringIndex}</v></c>`;
}

function nCell(reference: string, value: string): string {
  return `<c r="${reference}"><v>${value}</v></c>`;
}

function createZip(entries: Readonly<Record<string, string>>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name, "utf8");
    const contentBuffer = Buffer.from(content, "utf8");
    const compressedContent = deflateRawSync(contentBuffer);
    const localHeaderOffset = offset;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(compressedContent.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, compressedContent);
    offset += localHeader.length + nameBuffer.length + compressedContent.length;

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(compressedContent.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localHeaderOffset, 42);

    centralParts.push(centralHeader, nameBuffer);
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralDirectoryOffset = offset;
  const entryCount = Object.keys(entries).length;

  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt32LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(entryCount, 8);
  endOfCentralDirectory.writeUInt16LE(entryCount, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function xml(input: string): string {
  return input
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}
