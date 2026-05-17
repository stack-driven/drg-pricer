import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { FALLPAUSCHALEN_CATALOG_XLSX_PARSER_VERSION } from "../src/fallpauschalenCatalog.js";
import { makeSyntheticFallpauschalenXlsx } from "./xlsxFixture.js";

const SYNTHETIC_CSV = ["DRG;Bewertungsrelation", "A01A;1,234", "B79Z;0,700"].join("\n");
const DIST_TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(DIST_TEST_DIRECTORY, "..", "src", "cli.js");
const PACKAGE_JSON_PATH = join(DIST_TEST_DIRECTORY, "..", "..", "package.json");

describe("CLI", () => {
  it("prices one DRG case and emits stable JSON", () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "drg-price-lookup-cli-"));
    const rawDirectory = join(dataDirectory, "2025", "raw");
    mkdirSync(rawDirectory, { recursive: true });
    const catalogFilePath = join(rawDirectory, "synthetic.csv");
    writeFileSync(catalogFilePath, SYNTHETIC_CSV, "utf8");

    const result = spawnSync(
      process.execPath,
      [
        CLI_PATH,
        "--year",
        "2025",
        "--drg",
        "A01A",
        "--lbfw",
        "4000.00",
        "--data-dir",
        dataDirectory,
      ],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");

    const output = JSON.parse(result.stdout) as {
      status: string;
      amount: { value: string; currency: string };
      calculation: { formula: string; relativeWeight: string; landesbasisfallwert: string };
      source: { file: string; rowKey: string; sourceRowNumber: number };
    };

    assert.equal(output.status, "priced");
    assert.deepEqual(output.amount, { value: "4936.00", currency: "EUR" });
    assert.deepEqual(output.calculation, {
      formula: "relativeWeight * landesbasisfallwert",
      relativeWeight: "1.234",
      landesbasisfallwert: "4000.00",
    });
    assert.equal(output.source.file, catalogFilePath);
    assert.equal(output.source.rowKey, "A01A");
    assert.equal(output.source.sourceRowNumber, 2);
  });

  it("emits not_found JSON with catalogue context and candidates", () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "drg-price-lookup-cli-not-found-"));
    const rawDirectory = join(dataDirectory, "2025", "raw");
    mkdirSync(rawDirectory, { recursive: true });
    const catalogFilePath = join(rawDirectory, "synthetic.csv");
    writeFileSync(catalogFilePath, SYNTHETIC_CSV, "utf8");

    const result = spawnSync(
      process.execPath,
      [
        CLI_PATH,
        "--year",
        "2025",
        "--drg",
        "A01Z",
        "--lbfw",
        "4000.00",
        "--data-dir",
        dataDirectory,
      ],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      status: "not_found",
      errors: [
        {
          code: "DRG_NOT_FOUND",
          message: `DRG code A01Z was not found for catalogue year 2025 in ${catalogFilePath}. Closest exact-prefix candidates: A01A.`,
          details: {
            requestedDrgCode: "A01Z",
            catalogueYear: 2025,
            catalogueFile: catalogFilePath,
            parserVersion: "fallpauschalen-catalog-csv-2025-v1",
            closestDrgCodes: ["A01A"],
          },
        },
      ],
    });
  });

  it("prices one DRG from a dumped XLSX file in the default raw folder", () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "drg-price-lookup-cli-xlsx-"));
    const rawDirectory = join(dataDirectory, "2025", "raw");
    mkdirSync(rawDirectory, { recursive: true });
    const catalogFilePath = join(rawDirectory, "Fallpauschalenkatalog 2025_2024-09-26.xlsx");
    writeFileSync(catalogFilePath, makeSyntheticFallpauschalenXlsx());

    const result = spawnSync(
      process.execPath,
      [
        CLI_PATH,
        "--year",
        "2025",
        "--drg",
        "A01A",
        "--lbfw",
        "4000.00",
        "--data-dir",
        dataDirectory,
      ],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");

    const output = JSON.parse(result.stdout) as {
      status: string;
      amount: { value: string; currency: string };
      source: { file: string; parserVersion: string; sourceRowNumber: number; checksum?: string };
    };

    assert.equal(output.status, "priced");
    assert.deepEqual(output.amount, { value: "4936.00", currency: "EUR" });
    assert.equal(output.source.file, catalogFilePath);
    assert.equal(output.source.parserVersion, FALLPAUSCHALEN_CATALOG_XLSX_PARSER_VERSION);
    assert.equal(output.source.sourceRowNumber, 8);
    assert.match(output.source.checksum ?? "", /^sha256:[0-9a-f]{64}$/u);
  });

  it("prints help text", () => {
    const result = spawnSync(process.execPath, [CLI_PATH, "--help"], { encoding: "utf8" });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Usage:/u);
    assert.match(result.stdout, /--year <YYYY>/u);
    assert.match(result.stdout, /Supported XLSX years: 2022, 2023, 2024, 2025, 2026/u);
    assert.match(result.stdout, /data\/official\/\{year\}\/raw/u);
  });

  it("prints the package version", () => {
    const result = spawnSync(process.execPath, [CLI_PATH, "--version"], { encoding: "utf8" });
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as { version: string };

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout.trim(), packageJson.version);
  });

  it("returns helpful stable JSON errors for separated long options", () => {
    const result = spawnSync(
      process.execPath,
      [CLI_PATH, "--", "year", "2026", "--drg", "A01A", "--lbfw", "4000.00"],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      status: "error",
      errors: [
        {
          code: "UNKNOWN_OPTION",
          message: "Unknown option: --. Did you mean --year? Use --year without a space.",
        },
      ],
    });
  });

  it("returns stable JSON errors for invalid arguments", () => {
    const result = spawnSync(process.execPath, [CLI_PATH, "--year", "2025", "--drg", "A01A"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      status: "error",
      errors: [
        {
          code: "MISSING_REQUIRED_OPTION",
          message: "Missing required option: --lbfw",
        },
      ],
    });
  });
});
