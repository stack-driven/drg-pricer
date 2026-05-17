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
  parseFallpauschalenCatalogFile,
} from "../src/fallpauschalenCatalog.js";
import { makeSyntheticFallpauschalenXlsx } from "./xlsxFixture.js";

describe("parseFallpauschalenCatalogCsv", () => {
  it("parses a synthetic 2025 semicolon CSV catalogue", () => {
    const catalog = parseFallpauschalenCatalogCsv(
      [
        "DRG;Bewertungsrelation",
        "A01A;3,141",
        "B79Z;0,700",
      ].join("\n"),
      { year: 2025 },
    );

    assert.equal(catalog.year, 2025);
    assert.equal(catalog.parserVersion, FALLPAUSCHALEN_CATALOG_PARSER_VERSION);
    assert.equal(catalog.rows.length, 2);
    assert.deepEqual(catalog.rowsByDrgCode.get("A01A"), {
      drgCode: "A01A",
      relativeWeight: "3.141",
      sourceRowNumber: 2,
    });
    assert.deepEqual(catalog.rowsByDrgCode.get("B79Z"), {
      drgCode: "B79Z",
      relativeWeight: "0.700",
      sourceRowNumber: 3,
    });
  });

  it("parses a synthetic official-like 2025 XLSX catalogue", () => {
    const catalog = parseFallpauschalenCatalogFile(makeSyntheticFallpauschalenXlsx(), {
      year: 2025,
      filePath: "Fallpauschalenkatalog 2025_2024-09-26.xlsx",
    });

    assert.equal(catalog.year, 2025);
    assert.equal(catalog.parserVersion, FALLPAUSCHALEN_CATALOG_XLSX_PARSER_VERSION);
    assert.equal(catalog.rows.length, 2);
    assert.deepEqual(catalog.rowsByDrgCode.get("A01A"), {
      drgCode: "A01A",
      relativeWeight: "1.234",
      sourceRowNumber: 8,
    });
    assert.deepEqual(catalog.rowsByDrgCode.get("B79Z"), {
      drgCode: "B79Z",
      relativeWeight: "0.700",
      sourceRowNumber: 9,
    });
    assert.equal(catalog.rowsByDrgCode.get("960Z"), undefined);
  });

  it("parses a synthetic official-like 2022 XLSX catalogue", () => {
    const catalog = parseFallpauschalenCatalogFile(makeSyntheticFallpauschalenXlsx(), {
      year: 2022,
      filePath: "Fallpauschalenkatalog_2022_20211123.xlsx",
    });

    assert.equal(catalog.year, 2022);
    assert.equal(catalog.parserVersion, FALLPAUSCHALEN_CATALOG_XLSX_2022_PARSER_VERSION);
    assert.deepEqual(catalog.rowsByDrgCode.get("A01A"), {
      drgCode: "A01A",
      relativeWeight: "1.234",
      sourceRowNumber: 8,
    });
  });

  it("parses a synthetic official-like 2023 XLSX catalogue", () => {
    const catalog = parseFallpauschalenCatalogFile(makeSyntheticFallpauschalenXlsx(), {
      year: 2023,
      filePath: "Fallpauschalenkatalog_2023_20221124.xlsx",
    });

    assert.equal(catalog.year, 2023);
    assert.equal(catalog.parserVersion, FALLPAUSCHALEN_CATALOG_XLSX_2023_PARSER_VERSION);
    assert.deepEqual(catalog.rowsByDrgCode.get("A01A"), {
      drgCode: "A01A",
      relativeWeight: "1.234",
      sourceRowNumber: 8,
    });
  });

  it("parses a synthetic official-like 2024 XLSX catalogue", () => {
    const catalog = parseFallpauschalenCatalogFile(makeSyntheticFallpauschalenXlsx(), {
      year: 2024,
      filePath: "Fallpauschalenkatalog 2024_2024-09-26.xlsx",
    });

    assert.equal(catalog.year, 2024);
    assert.equal(catalog.parserVersion, FALLPAUSCHALEN_CATALOG_XLSX_2024_PARSER_VERSION);
    assert.deepEqual(catalog.rowsByDrgCode.get("A01A"), {
      drgCode: "A01A",
      relativeWeight: "1.234",
      sourceRowNumber: 8,
    });
  });

  it("parses a synthetic official-like 2026 XLSX catalogue", () => {
    const catalog = parseFallpauschalenCatalogFile(makeSyntheticFallpauschalenXlsx(), {
      year: 2026,
      filePath: "Fallpauschalenkatalog_2026_2025-11-19.xlsx",
    });

    assert.equal(catalog.year, 2026);
    assert.equal(catalog.parserVersion, FALLPAUSCHALEN_CATALOG_XLSX_2026_PARSER_VERSION);
    assert.deepEqual(catalog.rowsByDrgCode.get("A01A"), {
      drgCode: "A01A",
      relativeWeight: "1.234",
      sourceRowNumber: 8,
    });
  });

  it("normalizes DRG code case and whitespace", () => {
    const catalog = parseFallpauschalenCatalogCsv("DRG;Bewertungsrelation\n b79z ; 1,234 ", {
      year: 2025,
    });

    assert.deepEqual(catalog.rowsByDrgCode.get("B79Z"), {
      drgCode: "B79Z",
      relativeWeight: "1.234",
      sourceRowNumber: 2,
    });
  });

  it("accepts decimal dot relative weights", () => {
    const catalog = parseFallpauschalenCatalogCsv("DRG;Bewertungsrelation\nA01A;1.234", {
      year: 2025,
    });

    assert.equal(catalog.rowsByDrgCode.get("A01A")?.relativeWeight, "1.234");
  });

  it("keeps quoted semicolons in non-required columns boring and deterministic", () => {
    const catalog = parseFallpauschalenCatalogCsv(
      "DRG;Text;Bewertungsrelation\nA01A;\"synthetic; text\";2,000",
      { year: 2025 },
    );

    assert.equal(catalog.rowsByDrgCode.get("A01A")?.relativeWeight, "2.000");
  });

  it("rejects unsupported catalogue years", () => {
    assert.throws(
      () => parseFallpauschalenCatalogCsv("DRG;Bewertungsrelation\nA01A;1,000", { year: 2024 }),
      /Unsupported Fallpauschalen-Katalog year 2024/,
    );
  });

  it("rejects missing required columns", () => {
    assert.throws(
      () => parseFallpauschalenCatalogCsv("DRG;Other\nA01A;1,000", { year: 2025 }),
      /Missing required catalogue column: Bewertungsrelation/,
    );
  });

  it("rejects malformed rows", () => {
    assert.throws(
      () => parseFallpauschalenCatalogCsv("DRG;Bewertungsrelation\nA01A;1,000;extra", { year: 2025 }),
      /Malformed catalogue row 2/,
    );
  });

  it("rejects duplicate DRG codes", () => {
    assert.throws(
      () =>
        parseFallpauschalenCatalogCsv("DRG;Bewertungsrelation\nA01A;1,000\na01a;2,000", {
          year: 2025,
        }),
      /Duplicate DRG code A01A at source row 3/,
    );
  });

  it("rejects missing DRG codes", () => {
    assert.throws(
      () => parseFallpauschalenCatalogCsv("DRG;Bewertungsrelation\n ;1,000", { year: 2025 }),
      /Missing DRG code at source row 2/,
    );
  });

  it("rejects invalid relative weights", () => {
    for (const invalidWeight of ["", "abc", "-1", "1,234.56"]) {
      assert.throws(
        () =>
          parseFallpauschalenCatalogCsv(`DRG;Bewertungsrelation\nA01A;${invalidWeight}`, {
            year: 2025,
          }),
        /Invalid relative weight at source row 2/,
      );
    }
  });
});
