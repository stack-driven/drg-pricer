import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  parseFallpauschalenCatalogFile,
  type FallpauschalenCatalog,
  type FallpauschalenCatalogRow,
} from "./fallpauschalenCatalog.js";
import { formatMoney, multiplyMoneyByDecimal, parseMoney } from "./money.js";

export type PriceBaseDrgRequest = {
  readonly year: number;
  readonly drgCode: string;
  readonly landesbasisfallwert: string;
  readonly currency?: "EUR";
  readonly catalog?: FallpauschalenCatalog;
  readonly source?: PriceBaseDrgSourceInput;
  readonly catalogFilePath?: string;
  readonly dataDirectory?: string;
};

export type PriceBaseDrgSourceInput = {
  readonly file?: string;
  readonly checksum?: string;
};

export type PriceBaseDrgResponse =
  | PriceBaseDrgPricedResponse
  | PriceBaseDrgNotFoundResponse
  | PriceBaseDrgUnsupportedResponse
  | PriceBaseDrgErrorResponse;

export type PriceBaseDrgPricedResponse = {
  readonly status: "priced";
  readonly amount: {
    readonly value: string;
    readonly currency: "EUR";
  };
  readonly calculation: {
    readonly formula: "relativeWeight * landesbasisfallwert";
    readonly relativeWeight: string;
    readonly landesbasisfallwert: string;
  };
  readonly source: PriceBaseDrgSourceMetadata;
};

export type PriceBaseDrgNotFoundResponse = {
  readonly status: "not_found";
  readonly errors: readonly PriceBaseDrgError[];
};

export type PriceBaseDrgUnsupportedResponse = {
  readonly status: "unsupported";
  readonly errors: readonly PriceBaseDrgError[];
};

export type PriceBaseDrgErrorResponse = {
  readonly status: "error";
  readonly errors: readonly PriceBaseDrgError[];
};

export type PriceBaseDrgError = {
  readonly code: string;
  readonly message: string;
  readonly details?: PriceBaseDrgErrorDetails;
};

export type PriceBaseDrgErrorDetails = {
  readonly requestedDrgCode?: string;
  readonly catalogueYear?: number;
  readonly catalogueFile?: string;
  readonly parserVersion?: string;
  readonly closestDrgCodes?: readonly string[];
};

export type PriceBaseDrgSourceMetadata = {
  readonly year: number;
  readonly parserVersion: string;
  readonly rowKey: string;
  readonly sourceRowNumber: number;
  readonly file?: string;
  readonly checksum?: string;
};

type LoadedCatalog = {
  readonly catalog: FallpauschalenCatalog;
  readonly source: PriceBaseDrgSourceInput;
};

const SUPPORTED_LOCAL_FILE_YEARS = [2022, 2023, 2024, 2025, 2026] as const;
const FORMULA = "relativeWeight * landesbasisfallwert";

export function priceBaseDrg(request: PriceBaseDrgRequest): PriceBaseDrgResponse {
  if (request.currency !== undefined && request.currency !== "EUR") {
    return error("UNSUPPORTED_CURRENCY", "Only EUR Landesbasisfallwert values are supported");
  }

  let landesbasisfallwert: string;
  try {
    landesbasisfallwert = formatMoney(parseMoney(request.landesbasisfallwert));
  } catch (cause) {
    return error("INVALID_MONEY", errorMessage(cause));
  }

  const loaded = loadCatalog(request);
  if ("status" in loaded) {
    return loaded;
  }

  const drgCode = normalizeDrgCode(request.drgCode);
  if (drgCode === "") {
    return error("INVALID_DRG_CODE", "DRG code must not be empty");
  }

  const row = loaded.catalog.rowsByDrgCode.get(drgCode);
  if (row === undefined) {
    const details = drgNotFoundDetails(drgCode, loaded);
    return notFound("DRG_NOT_FOUND", drgNotFoundMessage(drgCode, details), details);
  }

  const amount = multiplyMoneyByDecimal(parseMoney(landesbasisfallwert), row.relativeWeight);

  return {
    status: "priced",
    amount: {
      value: formatMoney(amount),
      currency: "EUR",
    },
    calculation: {
      formula: FORMULA,
      relativeWeight: row.relativeWeight,
      landesbasisfallwert,
    },
    source: sourceMetadata(loaded, row),
  };
}

function loadCatalog(request: PriceBaseDrgRequest): LoadedCatalog | PriceBaseDrgUnsupportedResponse | PriceBaseDrgErrorResponse {
  if (request.catalog !== undefined) {
    if (request.catalog.year !== request.year) {
      return unsupported(
        "UNSUPPORTED_YEAR",
        `Request year ${request.year} does not match loaded catalogue year ${request.catalog.year}`,
      );
    }

    return {
      catalog: request.catalog,
      source: request.source ?? {},
    };
  }

  if (!isSupportedLocalFileYear(request.year)) {
    return unsupported(
      "UNSUPPORTED_YEAR",
      `Unsupported Fallpauschalen-Katalog year ${request.year}; only 2022, 2023, 2024, 2025, and 2026 local catalogue files are supported`,
    );
  }

  const catalogFilePathResult = resolveCatalogFilePath(request);
  if (typeof catalogFilePathResult !== "string") {
    return catalogFilePathResult;
  }

  let input: Buffer;
  try {
    input = readFileSync(catalogFilePathResult);
  } catch (cause) {
    return error("MISSING_CATALOG_FILE", `Could not read catalogue file ${catalogFilePathResult}: ${errorMessage(cause)}`);
  }

  try {
    return {
      catalog: parseFallpauschalenCatalogFile(input, {
        year: request.year,
        filePath: catalogFilePathResult,
      }),
      source: {
        file: catalogFilePathResult,
        checksum: `sha256:${createHash("sha256").update(input).digest("hex")}`,
      },
    };
  } catch (cause) {
    return error("INVALID_CATALOG", errorMessage(cause));
  }
}

function isSupportedLocalFileYear(year: number): boolean {
  return SUPPORTED_LOCAL_FILE_YEARS.some((supportedYear) => supportedYear === year);
}

function resolveCatalogFilePath(request: PriceBaseDrgRequest): string | PriceBaseDrgErrorResponse {
  if (request.catalogFilePath !== undefined) {
    return request.catalogFilePath;
  }

  if (request.dataDirectory === undefined) {
    return error(
      "MISSING_CATALOG_SOURCE",
      "Provide a parsed catalog, catalogFilePath, or dataDirectory before pricing a DRG",
    );
  }

  const rawDirectory = join(request.dataDirectory, String(request.year), "raw");
  if (!existsSync(rawDirectory)) {
    return error("MISSING_CATALOG_FILE", `Catalogue raw directory does not exist: ${rawDirectory}`);
  }

  const files = readdirSync(rawDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => join(rawDirectory, entry.name))
    .sort();

  if (files.length === 0) {
    return error("MISSING_CATALOG_FILE", `No catalogue files found in ${rawDirectory}`);
  }

  if (files.length > 1) {
    return error(
      "AMBIGUOUS_CATALOG_FILES",
      `Expected exactly one catalogue file in ${rawDirectory}, found ${files.length}`,
    );
  }

  const file = files[0];
  if (file === undefined) {
    return error("MISSING_CATALOG_FILE", `No catalogue files found in ${rawDirectory}`);
  }

  return file;
}

function sourceMetadata(loaded: LoadedCatalog, row: FallpauschalenCatalogRow): PriceBaseDrgSourceMetadata {
  return {
    year: loaded.catalog.year,
    parserVersion: loaded.catalog.parserVersion,
    rowKey: row.drgCode,
    sourceRowNumber: row.sourceRowNumber,
    ...optionalSourceMetadata(loaded.source),
  };
}

function optionalSourceMetadata(source: PriceBaseDrgSourceInput): Pick<PriceBaseDrgSourceMetadata, "file" | "checksum"> {
  const metadata: { file?: string; checksum?: string } = {};
  if (source.file !== undefined) {
    metadata.file = source.file;
  }
  if (source.checksum !== undefined) {
    metadata.checksum = source.checksum;
  }
  return metadata;
}

function normalizeDrgCode(input: string): string {
  return input.trim().toUpperCase();
}

function drgNotFoundDetails(drgCode: string, loaded: LoadedCatalog): PriceBaseDrgErrorDetails {
  const closestDrgCodes = closestExactPrefixDrgCodes(drgCode, loaded.catalog);
  return {
    requestedDrgCode: drgCode,
    catalogueYear: loaded.catalog.year,
    parserVersion: loaded.catalog.parserVersion,
    ...optionalNotFoundSourceDetails(loaded.source),
    ...(closestDrgCodes.length === 0 ? {} : { closestDrgCodes }),
  };
}

function optionalNotFoundSourceDetails(source: PriceBaseDrgSourceInput): Pick<PriceBaseDrgErrorDetails, "catalogueFile"> {
  return source.file === undefined ? {} : { catalogueFile: source.file };
}

function drgNotFoundMessage(drgCode: string, details: PriceBaseDrgErrorDetails): string {
  const catalogueYearText = details.catalogueYear === undefined ? "the loaded catalogue" : `catalogue year ${details.catalogueYear}`;
  const catalogueFileText = details.catalogueFile === undefined ? "" : ` in ${details.catalogueFile}`;
  const candidateText =
    details.closestDrgCodes === undefined
      ? " No close exact-prefix candidates were found."
      : ` Closest exact-prefix candidates: ${details.closestDrgCodes.join(", ")}.`;

  return `DRG code ${drgCode} was not found for ${catalogueYearText}${catalogueFileText}.${candidateText}`;
}

function closestExactPrefixDrgCodes(drgCode: string, catalog: FallpauschalenCatalog): readonly string[] {
  const minimumUsefulPrefixLength = 2;
  const maximumUsefulPrefixLength = Math.min(drgCode.length, 3);
  const catalogDrgCodes = Array.from(catalog.rowsByDrgCode.keys()).sort();

  for (let prefixLength = maximumUsefulPrefixLength; prefixLength >= minimumUsefulPrefixLength; prefixLength -= 1) {
    const prefix = drgCode.slice(0, prefixLength);
    const candidates = catalogDrgCodes.filter((candidate) => candidate.startsWith(prefix)).slice(0, 5);
    if (candidates.length > 0) {
      return candidates;
    }
  }

  return [];
}

function notFound(code: string, message: string, details?: PriceBaseDrgErrorDetails): PriceBaseDrgNotFoundResponse {
  return {
    status: "not_found",
    errors: [details === undefined ? { code, message } : { code, message, details }],
  };
}

function unsupported(code: string, message: string): PriceBaseDrgUnsupportedResponse {
  return {
    status: "unsupported",
    errors: [{ code, message }],
  };
}

function error(code: string, message: string): PriceBaseDrgErrorResponse {
  return {
    status: "error",
    errors: [{ code, message }],
  };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
