# Local official files

This directory is the local bring-your-own-data area for official catalogue files.

Get official catalogues yourself from the official InEK/G-DRG publication pages for the relevant
reimbursement year. Start with the [InEK 2022 DRG archive page](https://www.g-drg.de/archiv/drg-systemjahr-2022-datenjahr-2020),
the [InEK 2023 Fallpauschalen-Katalog page](https://www.g-drg.de/ag-drg-system-2023/fallpauschalen-katalog/fallpauschalen-katalog-20232),
the [InEK 2024 Fallpauschalen-Katalog page](https://www.g-drg.de/ag-drg-system-2024/fallpauschalen-katalog/fallpauschalen-katalog-20242),
the [InEK 2025 Fallpauschalen-Katalog page](https://www.g-drg.de/ag-drg-system-2025/fallpauschalen-katalog/fallpauschalen-katalog-2025),
or the [InEK 2026 Fallpauschalen-Katalog page](https://www.g-drg.de/ag-drg-system-2026/fallpauschalen-katalog/fallpauschalen-katalog-2026).
The repository intentionally ships no official raw files, parsed official datasets, or real-value
extracts, and the CLI does not download pricing data at runtime.

## Why files are not downloaded automatically

Official catalogue files are public, but this project keeps official data as local bring-your-own
input. A maintainer or user may explicitly download a file into the ignored local folder below, but
the library and CLI must not hide network access during pricing. This keeps provenance auditable:
you know which local file was used, where it came from, and which checksum was priced.

## Manual download/setup

1. Open the official InEK/G-DRG publication page for the reimbursement year.
2. Download the catalogue file yourself, keeping the original filename where practical.
3. Put the downloaded official file under the ignored raw-file folder:

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

   If you prefer a terminal download, run the explicit onboarding downloads yourself. These commands
   write only to ignored local folders; the library and CLI still never download pricing data at
   runtime:

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

   If an official URL changes, use the InEK publication page for that year and keep the downloaded
   file under `data/official/{year}/raw/`.

4. Keep exactly one non-hidden supported file in the year folder for default CLI discovery, or pass
   `--catalog-file /absolute/path/to/file`.
5. Verify the file remains local before committing code/docs:

   ```sh
   git status --ignored data/official
   ```

Convention:

```text
data/official/{year}/raw/
```

- `{year}` is the reimbursement/catalogue year, for example `2022`, `2023`, `2024`, `2025`, or `2026`.
- Keep local files private and ignored by git.
- Keep filenames close to their official source names where practical.
- Do not normalize or edit original official downloads in place.
- Do not commit official raw files, parsed official datasets, or real-value extracts unless legal/data review explicitly approves it.
- Parsers should treat files here as local inputs and report provenance such as file path, checksum, parser version, and source row when available.

Current parser slice:

- Supported years: `2022`, `2023`, `2024`, `2025`, and `2026` for official XLSX; `2025` for the simple CSV export parser.
- Supported file shapes:
  - Official XLSX download: sheet `Hauptabteilungen`, columns `DRG` and `Bewertungsrelation bei Hauptabteilung`.
  - 2025 semicolon-delimited CSV export: first non-empty row has exact headers `DRG` and `Bewertungsrelation`.
- For the official XLSX, the parser uses the Hauptabteilung base valuation column for the KISS formula `relativeWeight * LBFW`; rows without a numeric Hauptabteilung valuation are skipped for this base lookup.
- Default CLI discovery expects exactly one non-hidden supported file in `data/official/{year}/raw/`.
- Use `--catalog-file /path/to/file.xlsx` when you need to point at a specific parser-readable file.

Example local-only paths:

```text
data/official/2022/raw/Fallpauschalenkatalog_2022_20211123.xlsx
data/official/2023/raw/Fallpauschalenkatalog_2023_20221124.xlsx
data/official/2024/raw/Fallpauschalenkatalog 2024_2024-09-26.xlsx
data/official/2025/raw/Fallpauschalenkatalog 2025_2024-09-26.xlsx
data/official/2026/raw/Fallpauschalenkatalog_2026_2025-11-19.xlsx
```

The raw-file contents under `data/official/*/raw/` are ignored by version control by default.
