# drg-pricer

`drg-pricer` is an experimental, KISS-first local lookup engine for base German
DRG/aG-DRG pricing. Given a reimbursement year, a known DRG code, and a
caller-supplied Landesbasisfallwert (LBFW), it looks up the DRG relative weight in a
user-supplied official Fallpauschalen-Katalog file and returns
`relativeWeight * LBFW` with formula inputs and source file/row metadata.

In short: it prices one already-known base DRG from a local official catalogue file. It does not
group cases, derive DRGs from ICD/OPS or other clinical codes, choose an LBFW, download pricing data
at runtime, apply reimbursement adjustments, or provide billing advice.

## Product boundary

The first useful product slice is deliberately small:

- User downloads official public catalogue files themselves.
- User places those files in a documented local folder.
- The engine parses or indexes those local files.
- User calls `priceBaseDrg({ year, drgCode, lbfw })`.
- The engine returns the calculated base amount, formula inputs, and source metadata.

Out of scope by default:

- DRG grouping or automatic DRG derivation.
- ICD-10-GM, OPS, diagnoses, procedures, or clinical-code interpretation.
- Hidden downloads of official data at pricing time.
- Hidden lookup or estimation of local, negotiated, or hospital-specific monetary values.
- Bundled official raw files, parsed official tables, or real-value golden fixtures without legal
  review.
- ZE, NUB, Pflege, transfer, readmission, or length-of-stay adjustments in the first slice.
- Certified billing, reimbursement advice, or production claims.

## Data posture

The repository ships code, parsers, schemas, examples, and synthetic fixtures. Official artifacts
stay local by default.

Default rules:

- Users bring their own official files.
- The engine reads local files only; it does not silently download data at runtime.
- Official files live outside version control unless legal review explicitly approves committing
  them.
- Priced outputs identify the source file, checksum, parser version, row key, and source row used.
- Tests should use synthetic fixtures unless a real official value has been approved for
  redistribution.

Public repository data policy: this repository intentionally excludes official raw catalogues,
parsed official datasets, real-value golden fixtures, and local planning notes. A private deployment
may preload official files or derived data only after its owner approves that separate legal/data
posture.

### Local official-file folder convention

Place user-supplied official catalogue files under this ignored local path:

```text
data/official/{year}/raw/
```

`{year}` is the reimbursement/catalogue year, for example `2022`, `2023`, `2024`, `2025`, or `2026`. Keep
local files private, keep filenames close to the official source names where practical, and do not
normalize or edit original official downloads in place. The repository documents this folder but
does not ship official raw files. `.gitignore` keeps `data/official/*/raw/` contents out of version
control by default.

For the first parser slice, the CLI supports the official 2022, 2023, 2024, 2025, and 2026 XLSX downloads plus a
simple 2025 semicolon-delimited CSV export. For XLSX, it reads sheet `Hauptabteilungen` and uses
columns `DRG` and `Bewertungsrelation bei Hauptabteilung`; rows without a numeric Hauptabteilung
valuation are skipped for this base lookup. For CSV, the first non-empty row must contain exact
headers `DRG` and `Bewertungsrelation`. Decimal comma and decimal point relative weights are
accepted for CSV.
Default CLI discovery expects exactly one non-hidden supported file in `data/official/{year}/raw/`;
use `--catalog-file` to point at a specific parser-readable file.

Example local-only paths:

```text
data/official/2022/raw/Fallpauschalenkatalog_2022_20211123.xlsx
data/official/2023/raw/Fallpauschalenkatalog_2023_20221124.xlsx
data/official/2024/raw/Fallpauschalenkatalog 2024_2024-09-26.xlsx
data/official/2025/raw/Fallpauschalenkatalog 2025_2024-09-26.xlsx
data/official/2026/raw/Fallpauschalenkatalog_2026_2025-11-19.xlsx
```

## Quickstart

1. Install dependencies, build the local CLI, and inspect CLI help:

   ```sh
   npm install
   npm run build
   node dist/src/cli.js --help
   node dist/src/cli.js --version
   ```

2. Get the official catalogue yourself from the official InEK/G-DRG publication pages. Start with
   the [InEK 2022 DRG archive page](https://www.g-drg.de/archiv/drg-systemjahr-2022-datenjahr-2020),
   the [InEK 2023 Fallpauschalen-Katalog page](https://www.g-drg.de/ag-drg-system-2023/fallpauschalen-katalog/fallpauschalen-katalog-20232),
   the [InEK 2024 Fallpauschalen-Katalog page](https://www.g-drg.de/ag-drg-system-2024/fallpauschalen-katalog/fallpauschalen-katalog-20242),
   the [InEK 2025 Fallpauschalen-Katalog page](https://www.g-drg.de/ag-drg-system-2025/fallpauschalen-katalog/fallpauschalen-katalog-2025),
   or the [InEK 2026 Fallpauschalen-Katalog page](https://www.g-drg.de/ag-drg-system-2026/fallpauschalen-katalog/fallpauschalen-katalog-2026).
   The tool does not download pricing data at runtime, and the repository does not redistribute
   official values.

3. Put your local parser-readable catalogue file under the default BYOD folder. Either copy files
   you downloaded manually:

   ```sh
   mkdir -p data/official/2022/raw
   cp /path/to/Fallpauschalenkatalog_2022_20211123.xlsx data/official/2022/raw/

   mkdir -p data/official/2023/raw
   cp /path/to/Fallpauschalenkatalog_2023_20221124.xlsx data/official/2023/raw/

   mkdir -p data/official/2024/raw
   cp /path/to/Fallpauschalenkatalog\ 2024_2024-09-26.xlsx data/official/2024/raw/

   mkdir -p data/official/2025/raw
   cp /path/to/Fallpauschalenkatalog\ 2025_2024-09-26.xlsx data/official/2025/raw/

   mkdir -p data/official/2026/raw
   cp /path/to/Fallpauschalenkatalog_2026_2025-11-19.xlsx data/official/2026/raw/
   ```

   Or explicitly run the onboarding downloads yourself. These commands write only to ignored local
   folders; the CLI still never downloads pricing data at runtime:

   ```sh
   mkdir -p data/official/2022/raw data/official/2023/raw data/official/2024/raw data/official/2025/raw data/official/2026/raw

   curl -fL \
     'https://www.g-drg.de/content/download/10833/file/Fallpauschalenkatalog_2022_20211123.xlsx' \
     -o 'data/official/2022/raw/Fallpauschalenkatalog_2022_20211123.xlsx'

   curl -fL \
     'https://www.g-drg.de/content/download/12314/file/Fallpauschalenkatalog_2023_20221124.xlsx' \
     -o 'data/official/2023/raw/Fallpauschalenkatalog_2023_20221124.xlsx'

   curl -fL \
     'https://www.g-drg.de/content/download/13672/file/Fallpauschalenkatalog%202024_2024-09-26.xlsx' \
     -o 'data/official/2024/raw/Fallpauschalenkatalog 2024_2024-09-26.xlsx'

   curl -fL \
     'https://www.g-drg.de/content/download/14156/file/Fallpauschalenkatalog%202025_2024-09-26.xlsx' \
     -o 'data/official/2025/raw/Fallpauschalenkatalog 2025_2024-09-26.xlsx'

   curl -fL \
     'https://www.g-drg.de/content/download/17453/file/Fallpauschalenkatalog_2026_2025-11-19.xlsx' \
     -o 'data/official/2026/raw/Fallpauschalenkatalog_2026_2025-11-19.xlsx'
   ```

   If an official URL changes, use the InEK publication pages above and keep the downloaded file in
   the same ignored `data/official/{year}/raw/` folder. If the folder contains more than one file,
   pass the exact file instead:

   ```sh
   node dist/src/cli.js \
     --year 2024 \
     --drg <DRG_FROM_YOUR_CATALOGUE> \
     --lbfw <CALLER_SUPPLIED_LBFW_EUR> \
     --catalog-file /path/to/Fallpauschalenkatalog\ 2024_2024-09-26.xlsx
   ```

4. Run local lookups from the default folders. These examples use caller-supplied sample LBFW values;
   replace the DRG code or LBFW if your local catalogue/input differs.

   ```sh
   node dist/src/cli.js --year 2022 --drg A01A --lbfw 4000.00
   node dist/src/cli.js --year 2023 --drg A01A --lbfw 4000.00
   node dist/src/cli.js --year 2024 --drg A01A --lbfw 4000.00
   node dist/src/cli.js --year 2025 --drg B79Z --lbfw 4000.00
   node dist/src/cli.js --year 2026 --drg A01A --lbfw 4000.00
   ```

   The CLI prints stable JSON for pricing and error responses. A priced response reports
   `relativeWeight * landesbasisfallwert`, the calculated EUR amount, and source metadata. A
   `DRG_NOT_FOUND` response includes the searched catalogue year, local file when available, parser
   version, and close exact-prefix DRG candidates when any exist. The DRG code must already be known,
   and the LBFW must be supplied by the caller. Use `--help` for supported options and examples.

5. Optional synthetic smoke test without official data:

   ```sh
   mkdir -p /tmp/drg-pricer-demo/2025/raw
   printf 'DRG;Bewertungsrelation\nSYN1;1,234\n' >/tmp/drg-pricer-demo/2025/raw/synthetic.csv
   node dist/src/cli.js --year 2025 --drg SYN1 --lbfw 4000.00 --data-dir /tmp/drg-pricer-demo
   ```

This is experimental software. It performs only the base lookup formula and does not group cases,
interpret clinical codes, choose an LBFW, apply adjustments, or provide billing advice.

## Provenance fields

A priced response includes a `source` object so the lookup can be audited against local inputs:

- `source.file`: local catalogue file path used for the lookup, when loaded from a file or data
  directory.
- `source.checksum`: SHA-256 checksum of that local file, formatted as `sha256:<hex>`, when loaded
  from a file or data directory.
- `source.parserVersion`: parser identifier for the accepted catalogue shape, such as
  `fallpauschalen-catalog-xlsx-2025-v1`.
- `source.rowKey`: normalized DRG key matched in the catalogue.
- `source.sourceRowNumber`: source row number reported by the parser for the matched catalogue row.

## Minimal calculation

```text
baseDrgAmount = relativeWeight * landesbasisfallwert
```

Required inputs for the first pricing API:

- `year`: reimbursement year.
- `drgCode`: already-known DRG/aG-DRG code.
- `lbfw`: caller-supplied Landesbasisfallwert money amount.

`priceBaseDrg` returns stable JSON-like objects with `status: "priced" | "not_found" |
"unsupported" | "error"`. A priced response includes `amount.value`, `amount.currency`,
formula inputs, and source row metadata; file and checksum metadata are included when pricing from
a local catalogue file or data directory. A `DRG_NOT_FOUND` response includes `errors[].details`
with the normalized requested DRG code, searched catalogue year, parser version, local catalogue
file when available, and close exact-prefix DRG candidates when any exist.

## Current status

This repository has initial TypeScript money primitives, hardened synthetic-tested 2022/2023/2024/2025/2026
XLSX and 2025 semicolon CSV Fallpauschalen-Katalog parsers, the `priceBaseDrg` core API, a small
JSON-emitting CLI wrapper, and quickstart documentation for local BYOD catalogue files. Future
pricing slices should preserve the accepted ADR boundaries unless a later public ADR changes them.
See the ADRs for the accepted product and data decisions.

## Development commands

```sh
npm run build      # compile TypeScript to dist/
npm run typecheck  # run strict checks without emitting files
npm test           # build and run the Node test suite
npm run check      # typecheck, then run the full test suite
```

## Documentation

- [Product philosophy](drg-pricer-product-philosophy.md)
- [Post-MVP functions investigation](docs/post-mvp-functions-investigation.md)
- [ADR index](docs/adr/README.md)
- [ADR 0001: KISS base DRG lookup boundary](docs/adr/0001-adopt-kiss-base-drg-lookup-boundary.md)
- [ADR 0002: Local BYOD official-data posture](docs/adr/0002-adopt-local-byod-official-data-posture.md)

## Safety note

`drg-pricer` is experimental software. It is not certified billing software and must not be
used as the sole basis for claims, reimbursement decisions, or legal compliance.
