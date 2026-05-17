import { readXlsxWorkbook, type XlsxRow, type XlsxSheet } from "./xlsxWorkbook.js";

export const FALLPAUSCHALEN_CATALOG_CSV_PARSER_VERSION = "fallpauschalen-catalog-csv-2025-v1";
export const FALLPAUSCHALEN_CATALOG_XLSX_2022_PARSER_VERSION = "fallpauschalen-catalog-xlsx-2022-v1";
export const FALLPAUSCHALEN_CATALOG_XLSX_2023_PARSER_VERSION = "fallpauschalen-catalog-xlsx-2023-v1";
export const FALLPAUSCHALEN_CATALOG_XLSX_2024_PARSER_VERSION = "fallpauschalen-catalog-xlsx-2024-v1";
export const FALLPAUSCHALEN_CATALOG_XLSX_2025_PARSER_VERSION = "fallpauschalen-catalog-xlsx-2025-v1";
export const FALLPAUSCHALEN_CATALOG_XLSX_2026_PARSER_VERSION = "fallpauschalen-catalog-xlsx-2026-v1";
export const FALLPAUSCHALEN_CATALOG_XLSX_PARSER_VERSION = FALLPAUSCHALEN_CATALOG_XLSX_2025_PARSER_VERSION;
export const FALLPAUSCHALEN_CATALOG_PARSER_VERSION = FALLPAUSCHALEN_CATALOG_CSV_PARSER_VERSION;

export type SupportedFallpauschalenCatalogYear = 2022 | 2023 | 2024 | 2025 | 2026;
export type FallpauschalenCatalogParserVersion =
  | typeof FALLPAUSCHALEN_CATALOG_CSV_PARSER_VERSION
  | typeof FALLPAUSCHALEN_CATALOG_XLSX_2022_PARSER_VERSION
  | typeof FALLPAUSCHALEN_CATALOG_XLSX_2023_PARSER_VERSION
  | typeof FALLPAUSCHALEN_CATALOG_XLSX_2024_PARSER_VERSION
  | typeof FALLPAUSCHALEN_CATALOG_XLSX_2025_PARSER_VERSION
  | typeof FALLPAUSCHALEN_CATALOG_XLSX_2026_PARSER_VERSION;

export type FallpauschalenCatalogCsvOptions = {
  readonly year: number;
};

export type FallpauschalenCatalogFileOptions = {
  readonly year: number;
  readonly filePath?: string;
};

export type FallpauschalenCatalogRow = {
  readonly drgCode: string;
  readonly relativeWeight: string;
  readonly sourceRowNumber: number;
};

export type FallpauschalenCatalog = {
  readonly year: SupportedFallpauschalenCatalogYear;
  readonly parserVersion: FallpauschalenCatalogParserVersion;
  readonly rows: readonly FallpauschalenCatalogRow[];
  readonly rowsByDrgCode: ReadonlyMap<string, FallpauschalenCatalogRow>;
};

const SUPPORTED_CSV_YEAR: SupportedFallpauschalenCatalogYear = 2025;
const SUPPORTED_XLSX_YEARS = [2022, 2023, 2024, 2025, 2026] as const;
const REQUIRED_DRG_HEADER = "DRG";
const REQUIRED_CSV_RELATIVE_WEIGHT_HEADER = "Bewertungsrelation";
const REQUIRED_XLSX_RELATIVE_WEIGHT_HEADER = "Bewertungsrelation bei Hauptabteilung";
const XLSX_MAIN_SHEET_NAME = "Hauptabteilungen";
const DECIMAL_PATTERN = /^(?<whole>\d+)(?:(?<separator>[.,])(?<fraction>\d+))?$/u;
const LIKELY_DRG_CODE_PATTERN = /^[A-Z0-9]{4}$/u;

export function parseFallpauschalenCatalogFile(
  input: Uint8Array,
  options: FallpauschalenCatalogFileOptions,
): FallpauschalenCatalog {
  if (isXlsxFile(input, options.filePath)) {
    return parseFallpauschalenCatalogXlsx(input, options);
  }

  return parseFallpauschalenCatalogCsv(Buffer.from(input).toString("utf8"), options);
}

export function parseFallpauschalenCatalogCsv(
  input: string,
  options: FallpauschalenCatalogCsvOptions,
): FallpauschalenCatalog {
  assertSupportedCsvYear(options.year);

  const physicalLines = input.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  const header = findHeader(physicalLines);
  const drgColumnIndex = findRequiredHeaderIndex(header.cells, REQUIRED_DRG_HEADER);
  const relativeWeightColumnIndex = findRequiredHeaderIndex(
    header.cells,
    REQUIRED_CSV_RELATIVE_WEIGHT_HEADER,
  );

  const rows: FallpauschalenCatalogRow[] = [];
  const rowsByDrgCode = new Map<string, FallpauschalenCatalogRow>();

  for (let lineIndex = header.lineIndex + 1; lineIndex < physicalLines.length; lineIndex += 1) {
    const line = physicalLines[lineIndex];
    if (line === undefined || line.trim() === "") {
      continue;
    }

    const sourceRowNumber = lineIndex + 1;
    const cells = parseSemicolonDelimitedLine(line, sourceRowNumber).map((cell) => cell.trim());

    if (cells.length !== header.cells.length) {
      throw new Error(
        `Malformed catalogue row ${sourceRowNumber}: expected ${header.cells.length} cells, got ${cells.length}`,
      );
    }

    const drgCode = normalizeDrgCode(cells[drgColumnIndex], sourceRowNumber);
    const relativeWeight = normalizeRelativeWeight(
      cells[relativeWeightColumnIndex],
      sourceRowNumber,
    );

    addCatalogRow(rows, rowsByDrgCode, {
      drgCode,
      relativeWeight,
      sourceRowNumber,
    });
  }

  return {
    year: SUPPORTED_CSV_YEAR,
    parserVersion: FALLPAUSCHALEN_CATALOG_CSV_PARSER_VERSION,
    rows,
    rowsByDrgCode,
  };
}

export function parseFallpauschalenCatalogXlsx(
  input: Uint8Array,
  options: FallpauschalenCatalogFileOptions,
): FallpauschalenCatalog {
  assertSupportedXlsxYear(options.year);

  const workbook = readXlsxWorkbook(input);
  const sheet = findFallpauschalenXlsxSheet(workbook.sheets);
  const header = findXlsxHeader(sheet.rows);
  if (header === undefined) {
    throw new Error(
      `Missing required catalogue columns in XLSX sheet ${sheet.name}: ${REQUIRED_DRG_HEADER} and ${REQUIRED_XLSX_RELATIVE_WEIGHT_HEADER}`,
    );
  }

  const rows: FallpauschalenCatalogRow[] = [];
  const rowsByDrgCode = new Map<string, FallpauschalenCatalogRow>();

  for (const row of sheet.rows) {
    if (row.rowNumber <= header.rowNumber) {
      continue;
    }

    const maybeDrgCode = normalizeOptionalDrgCode(row.cells[header.drgColumnIndex]);
    if (!isLikelyDrgCode(maybeDrgCode)) {
      continue;
    }

    const relativeWeightInput = row.cells[header.relativeWeightColumnIndex];
    if (isMissingXlsxRelativeWeight(relativeWeightInput)) {
      continue;
    }

    addCatalogRow(rows, rowsByDrgCode, {
      drgCode: maybeDrgCode,
      relativeWeight: normalizeXlsxRelativeWeight(relativeWeightInput, row.rowNumber),
      sourceRowNumber: row.rowNumber,
    });
  }

  if (rows.length === 0) {
    throw new Error(`No DRG rows found in XLSX sheet ${sheet.name}`);
  }

  return {
    year: options.year,
    parserVersion: xlsxParserVersion(options.year),
    rows,
    rowsByDrgCode,
  };
}

function assertSupportedCsvYear(year: number): void {
  if (year !== SUPPORTED_CSV_YEAR) {
    throw new Error(
      `Unsupported Fallpauschalen-Katalog year ${year}; only ${SUPPORTED_CSV_YEAR} semicolon CSV is supported`,
    );
  }
}

function assertSupportedXlsxYear(year: number): asserts year is (typeof SUPPORTED_XLSX_YEARS)[number] {
  if (!SUPPORTED_XLSX_YEARS.some((supportedYear) => supportedYear === year)) {
    throw new Error(
      `Unsupported Fallpauschalen-Katalog year ${year}; only 2022, 2023, 2024, 2025, and 2026 official XLSX files are supported`,
    );
  }
}

function xlsxParserVersion(
  year: (typeof SUPPORTED_XLSX_YEARS)[number],
):
  | typeof FALLPAUSCHALEN_CATALOG_XLSX_2022_PARSER_VERSION
  | typeof FALLPAUSCHALEN_CATALOG_XLSX_2023_PARSER_VERSION
  | typeof FALLPAUSCHALEN_CATALOG_XLSX_2024_PARSER_VERSION
  | typeof FALLPAUSCHALEN_CATALOG_XLSX_2025_PARSER_VERSION
  | typeof FALLPAUSCHALEN_CATALOG_XLSX_2026_PARSER_VERSION {
  switch (year) {
    case 2022:
      return FALLPAUSCHALEN_CATALOG_XLSX_2022_PARSER_VERSION;
    case 2023:
      return FALLPAUSCHALEN_CATALOG_XLSX_2023_PARSER_VERSION;
    case 2024:
      return FALLPAUSCHALEN_CATALOG_XLSX_2024_PARSER_VERSION;
    case 2025:
      return FALLPAUSCHALEN_CATALOG_XLSX_2025_PARSER_VERSION;
    case 2026:
      return FALLPAUSCHALEN_CATALOG_XLSX_2026_PARSER_VERSION;
  }
}

function isXlsxFile(input: Uint8Array, filePath: string | undefined): boolean {
  if (filePath?.toLowerCase().endsWith(".xlsx") === true) {
    return true;
  }

  return input[0] === 0x50 && input[1] === 0x4b;
}

function findFallpauschalenXlsxSheet(sheets: readonly XlsxSheet[]): XlsxSheet {
  const namedSheet = sheets.find((sheet) => sheet.name === XLSX_MAIN_SHEET_NAME);
  if (namedSheet !== undefined) {
    return namedSheet;
  }

  const sheetWithHeaders = sheets.find((sheet) => findXlsxHeader(sheet.rows) !== undefined);
  if (sheetWithHeaders !== undefined) {
    return sheetWithHeaders;
  }

  throw new Error(`Missing XLSX sheet ${XLSX_MAIN_SHEET_NAME}`);
}

function findXlsxHeader(
  rows: readonly XlsxRow[],
):
  | {
      readonly rowNumber: number;
      readonly drgColumnIndex: number;
      readonly relativeWeightColumnIndex: number;
    }
  | undefined {
  for (const row of rows) {
    const normalizedHeaders = row.cells.map((cell) => normalizeHeader(cell));
    const drgColumnIndex = normalizedHeaders.findIndex((header) => header === REQUIRED_DRG_HEADER);
    const relativeWeightColumnIndex = normalizedHeaders.findIndex(
      (header) => header === REQUIRED_XLSX_RELATIVE_WEIGHT_HEADER,
    );

    if (drgColumnIndex !== -1 && relativeWeightColumnIndex !== -1) {
      return {
        rowNumber: row.rowNumber,
        drgColumnIndex,
        relativeWeightColumnIndex,
      };
    }
  }

  return undefined;
}

function normalizeHeader(input: string | undefined): string {
  return input?.replace(/\s+/gu, " ").trim() ?? "";
}

function findHeader(lines: readonly string[]): { readonly cells: readonly string[]; readonly lineIndex: number } {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (line === undefined || line.trim() === "") {
      continue;
    }

    return {
      cells: parseSemicolonDelimitedLine(line, lineIndex + 1).map((cell) => cell.trim()),
      lineIndex,
    };
  }

  throw new Error("Fallpauschalen-Katalog CSV is empty");
}

function findRequiredHeaderIndex(headers: readonly string[], headerName: string): number {
  const index = headers.findIndex((header) => header === headerName);

  if (index === -1) {
    throw new Error(`Missing required catalogue column: ${headerName}`);
  }

  return index;
}

function normalizeDrgCode(input: string | undefined, sourceRowNumber: number): string {
  const drgCode = normalizeOptionalDrgCode(input);

  if (drgCode === "") {
    throw new Error(`Missing DRG code at source row ${sourceRowNumber}`);
  }

  return drgCode;
}

function normalizeOptionalDrgCode(input: string | undefined): string {
  return input?.trim().toUpperCase() ?? "";
}

function isLikelyDrgCode(input: string): boolean {
  return LIKELY_DRG_CODE_PATTERN.test(input) && /[A-Z]/u.test(input) && /\d/u.test(input);
}

function normalizeRelativeWeight(input: string | undefined, sourceRowNumber: number): string {
  const value = input?.trim() ?? "";
  const match = DECIMAL_PATTERN.exec(value);

  if (!match?.groups) {
    throw new Error(
      `Invalid relative weight at source row ${sourceRowNumber}: expected a non-negative decimal string`,
    );
  }

  const wholeDigits = match.groups.whole;
  if (wholeDigits === undefined) {
    throw new Error(
      `Invalid relative weight at source row ${sourceRowNumber}: expected a non-negative decimal string`,
    );
  }

  const whole = BigInt(wholeDigits).toString();
  const fraction = match.groups.fraction;

  if (fraction === undefined) {
    return whole;
  }

  return `${whole}.${fraction}`;
}

function isMissingXlsxRelativeWeight(input: string | undefined): boolean {
  const value = input?.trim() ?? "";
  return value === "" || value === "-";
}

function normalizeXlsxRelativeWeight(input: string | undefined, sourceRowNumber: number): string {
  const value = normalizeRelativeWeight(input, sourceRowNumber);
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error(
      `Invalid relative weight at source row ${sourceRowNumber}: expected a finite decimal string`,
    );
  }

  return numericValue.toFixed(3);
}

function addCatalogRow(
  rows: FallpauschalenCatalogRow[],
  rowsByDrgCode: Map<string, FallpauschalenCatalogRow>,
  row: FallpauschalenCatalogRow,
): void {
  if (rowsByDrgCode.has(row.drgCode)) {
    throw new Error(`Duplicate DRG code ${row.drgCode} at source row ${row.sourceRowNumber}`);
  }

  rows.push(row);
  rowsByDrgCode.set(row.drgCode, row);
}

function parseSemicolonDelimitedLine(line: string, sourceRowNumber: number): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let afterClosingQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);
    const nextChar = line.charAt(index + 1);

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
        continue;
      }

      if (inQuotes) {
        inQuotes = false;
        afterClosingQuote = true;
        continue;
      }

      if (cell.trim() !== "") {
        throw new Error(`Malformed quoted cell at source row ${sourceRowNumber}`);
      }

      inQuotes = true;
      continue;
    }

    if (char === ";" && !inQuotes) {
      cells.push(cell);
      cell = "";
      afterClosingQuote = false;
      continue;
    }

    if (afterClosingQuote && char.trim() !== "") {
      throw new Error(`Malformed quoted cell at source row ${sourceRowNumber}`);
    }

    cell += char;
  }

  if (inQuotes) {
    throw new Error(`Unclosed quoted cell at source row ${sourceRowNumber}`);
  }

  cells.push(cell);
  return cells;
}
