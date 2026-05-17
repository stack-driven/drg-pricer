import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FALLPAUSCHALEN_CATALOG_PARSER_VERSION,
  FALLPAUSCHALEN_CATALOG_XLSX_2022_PARSER_VERSION,
  FALLPAUSCHALEN_CATALOG_XLSX_2023_PARSER_VERSION,
  FALLPAUSCHALEN_CATALOG_XLSX_2024_PARSER_VERSION,
  FALLPAUSCHALEN_CATALOG_XLSX_2026_PARSER_VERSION,
  FALLPAUSCHALEN_CATALOG_XLSX_PARSER_VERSION,
  parseFallpauschalenCatalogCsv,
} from "../src/fallpauschalenCatalog.js";
import { priceBaseDrg } from "../src/priceBaseDrg.js";
import { makeSyntheticFallpauschalenXlsx } from "./xlsxFixture.js";

const SYNTHETIC_CSV = ["DRG;Bewertungsrelation", "A01A;1,234", "B79Z;0,700"].join("\n");

function syntheticCatalog() {
  return parseFallpauschalenCatalogCsv(SYNTHETIC_CSV, { year: 2025 });
}

describe("priceBaseDrg", () => {
  it("prices a known DRG deterministically from a parsed catalog", () => {
    const response = priceBaseDrg({
      year: 2025,
      drgCode: "A01A",
      landesbasisfallwert: "4000.00",
      catalog: syntheticCatalog(),
      source: {
        file: "synthetic.csv",
        checksum: "sha256:synthetic",
      },
    });

    assert.deepEqual(response, {
      status: "priced",
      amount: {
        value: "4936.00",
        currency: "EUR",
      },
      calculation: {
        formula: "relativeWeight * landesbasisfallwert",
        relativeWeight: "1.234",
        landesbasisfallwert: "4000.00",
      },
      source: {
        year: 2025,
        file: "synthetic.csv",
        checksum: "sha256:synthetic",
        rowKey: "A01A",
        sourceRowNumber: 2,
        parserVersion: FALLPAUSCHALEN_CATALOG_PARSER_VERSION,
      },
    });
  });

  it("normalizes DRG code and Landesbasisfallwert formatting", () => {
    const response = priceBaseDrg({
      year: 2025,
      drgCode: " b79z ",
      landesbasisfallwert: "4000",
      catalog: syntheticCatalog(),
    });

    assert.equal(response.status, "priced");
    assert.equal(response.status === "priced" ? response.amount.value : undefined, "2800.00");
    assert.equal(
      response.status === "priced" ? response.calculation.landesbasisfallwert : undefined,
      "4000.00",
    );
    assert.equal(response.status === "priced" ? response.source.rowKey : undefined, "B79Z");
  });

  it("loads one local catalogue file and reports file plus checksum metadata", () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "drg-price-lookup-"));
    const rawDirectory = join(dataDirectory, "2025", "raw");
    mkdirSync(rawDirectory, { recursive: true });
    const catalogFilePath = join(rawDirectory, "synthetic.csv");
    writeFileSync(catalogFilePath, SYNTHETIC_CSV, "utf8");

    const response = priceBaseDrg({
      year: 2025,
      drgCode: "A01A",
      landesbasisfallwert: "4000.00",
      dataDirectory,
    });

    assert.equal(response.status, "priced");
    assert.equal(response.status === "priced" ? response.source.file : undefined, catalogFilePath);
    assert.equal(
      response.status === "priced" ? response.source.checksum : undefined,
      `sha256:${createHash("sha256").update(SYNTHETIC_CSV).digest("hex")}`,
    );
  });

  it("loads one local XLSX catalogue file and reports provenance metadata", () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "drg-price-lookup-xlsx-"));
    const rawDirectory = join(dataDirectory, "2025", "raw");
    mkdirSync(rawDirectory, { recursive: true });
    const catalogFilePath = join(rawDirectory, "Fallpauschalenkatalog 2025_2024-09-26.xlsx");
    const xlsx = makeSyntheticFallpauschalenXlsx();
    writeFileSync(catalogFilePath, xlsx);

    const response = priceBaseDrg({
      year: 2025,
      drgCode: "A01A",
      landesbasisfallwert: "4000.00",
      dataDirectory,
    });

    assert.equal(response.status, "priced");
    assert.equal(response.status === "priced" ? response.amount.value : undefined, "4936.00");
    assert.equal(response.status === "priced" ? response.source.file : undefined, catalogFilePath);
    assert.equal(
      response.status === "priced" ? response.source.checksum : undefined,
      `sha256:${createHash("sha256").update(xlsx).digest("hex")}`,
    );
    assert.equal(
      response.status === "priced" ? response.source.parserVersion : undefined,
      FALLPAUSCHALEN_CATALOG_XLSX_PARSER_VERSION,
    );
    assert.equal(response.status === "priced" ? response.source.sourceRowNumber : undefined, 8);
  });

  it("loads one local 2022 XLSX catalogue file", () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "drg-price-lookup-2022-xlsx-"));
    const rawDirectory = join(dataDirectory, "2022", "raw");
    mkdirSync(rawDirectory, { recursive: true });
    const catalogFilePath = join(rawDirectory, "Fallpauschalenkatalog_2022_20211123.xlsx");
    writeFileSync(catalogFilePath, makeSyntheticFallpauschalenXlsx());

    const response = priceBaseDrg({
      year: 2022,
      drgCode: "A01A",
      landesbasisfallwert: "4000.00",
      dataDirectory,
    });

    assert.equal(response.status, "priced");
    assert.equal(response.status === "priced" ? response.amount.value : undefined, "4936.00");
    assert.equal(
      response.status === "priced" ? response.source.parserVersion : undefined,
      FALLPAUSCHALEN_CATALOG_XLSX_2022_PARSER_VERSION,
    );
    assert.equal(response.status === "priced" ? response.source.year : undefined, 2022);
  });

  it("loads one local 2023 XLSX catalogue file", () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "drg-price-lookup-2023-xlsx-"));
    const rawDirectory = join(dataDirectory, "2023", "raw");
    mkdirSync(rawDirectory, { recursive: true });
    const catalogFilePath = join(rawDirectory, "Fallpauschalenkatalog_2023_20221124.xlsx");
    writeFileSync(catalogFilePath, makeSyntheticFallpauschalenXlsx());

    const response = priceBaseDrg({
      year: 2023,
      drgCode: "A01A",
      landesbasisfallwert: "4000.00",
      dataDirectory,
    });

    assert.equal(response.status, "priced");
    assert.equal(response.status === "priced" ? response.amount.value : undefined, "4936.00");
    assert.equal(
      response.status === "priced" ? response.source.parserVersion : undefined,
      FALLPAUSCHALEN_CATALOG_XLSX_2023_PARSER_VERSION,
    );
    assert.equal(response.status === "priced" ? response.source.year : undefined, 2023);
  });

  it("loads one local 2024 XLSX catalogue file", () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "drg-price-lookup-2024-xlsx-"));
    const rawDirectory = join(dataDirectory, "2024", "raw");
    mkdirSync(rawDirectory, { recursive: true });
    const catalogFilePath = join(rawDirectory, "Fallpauschalenkatalog 2024_2024-09-26.xlsx");
    writeFileSync(catalogFilePath, makeSyntheticFallpauschalenXlsx());

    const response = priceBaseDrg({
      year: 2024,
      drgCode: "A01A",
      landesbasisfallwert: "4000.00",
      dataDirectory,
    });

    assert.equal(response.status, "priced");
    assert.equal(response.status === "priced" ? response.amount.value : undefined, "4936.00");
    assert.equal(
      response.status === "priced" ? response.source.parserVersion : undefined,
      FALLPAUSCHALEN_CATALOG_XLSX_2024_PARSER_VERSION,
    );
    assert.equal(response.status === "priced" ? response.source.year : undefined, 2024);
  });

  it("loads one local 2026 XLSX catalogue file", () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "drg-price-lookup-2026-xlsx-"));
    const rawDirectory = join(dataDirectory, "2026", "raw");
    mkdirSync(rawDirectory, { recursive: true });
    const catalogFilePath = join(rawDirectory, "Fallpauschalenkatalog_2026_2025-11-19.xlsx");
    writeFileSync(catalogFilePath, makeSyntheticFallpauschalenXlsx());

    const response = priceBaseDrg({
      year: 2026,
      drgCode: "A01A",
      landesbasisfallwert: "4000.00",
      dataDirectory,
    });

    assert.equal(response.status, "priced");
    assert.equal(response.status === "priced" ? response.amount.value : undefined, "4936.00");
    assert.equal(
      response.status === "priced" ? response.source.parserVersion : undefined,
      FALLPAUSCHALEN_CATALOG_XLSX_2026_PARSER_VERSION,
    );
    assert.equal(response.status === "priced" ? response.source.year : undefined, 2026);
  });

  it("returns not_found with catalogue context and close prefix candidates", () => {
    assert.deepEqual(
      priceBaseDrg({
        year: 2025,
        drgCode: "A01Z",
        landesbasisfallwert: "4000.00",
        catalog: syntheticCatalog(),
        source: {
          file: "synthetic.csv",
        },
      }),
      {
        status: "not_found",
        errors: [
          {
            code: "DRG_NOT_FOUND",
            message:
              "DRG code A01Z was not found for catalogue year 2025 in synthetic.csv. Closest exact-prefix candidates: A01A.",
            details: {
              requestedDrgCode: "A01Z",
              catalogueYear: 2025,
              catalogueFile: "synthetic.csv",
              parserVersion: FALLPAUSCHALEN_CATALOG_PARSER_VERSION,
              closestDrgCodes: ["A01A"],
            },
          },
        ],
      },
    );
  });

  it("returns unsupported for unsupported years", () => {
    assert.deepEqual(
      priceBaseDrg({
        year: 2021,
        drgCode: "A01A",
        landesbasisfallwert: "4000.00",
        dataDirectory: "data/official",
      }),
      {
        status: "unsupported",
        errors: [
          {
            code: "UNSUPPORTED_YEAR",
            message: "Unsupported Fallpauschalen-Katalog year 2021; only 2022, 2023, 2024, 2025, and 2026 local catalogue files are supported",
          },
        ],
      },
    );
  });

  it("returns an error for invalid money", () => {
    assert.deepEqual(
      priceBaseDrg({
        year: 2025,
        drgCode: "A01A",
        landesbasisfallwert: "4000.001",
        catalog: syntheticCatalog(),
      }),
      {
        status: "error",
        errors: [
          {
            code: "INVALID_MONEY",
            message: "Money amount must have at most two decimal places",
          },
        ],
      },
    );
  });

  it("returns an error when no local catalogue file is available", () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "drg-price-lookup-empty-"));

    assert.deepEqual(
      priceBaseDrg({
        year: 2025,
        drgCode: "A01A",
        landesbasisfallwert: "4000.00",
        dataDirectory,
      }),
      {
        status: "error",
        errors: [
          {
            code: "MISSING_CATALOG_FILE",
            message: `Catalogue raw directory does not exist: ${join(dataDirectory, "2025", "raw")}`,
          },
        ],
      },
    );
  });
});
