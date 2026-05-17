# drg-pricer product philosophy

## Purpose

`drg-pricer` should be a small deterministic lookup-and-calculation engine for already-grouped German DRG/aG-DRG inpatient cases.

The core product promise is:

> Given a reimbursement year, an already-known DRG/aG-DRG code, caller-supplied local monetary inputs, and official catalogue files supplied by the user, return a deterministic base price estimate with a clear explanation of which local file and catalogue row were used.

This repo should not start as a broad reimbursement platform. It should start as a boring, reliable calculator over user-provided official files.

## KISS principle

Keep the product centered on one primitive:

```text
YEAR + DRG CODE + LBFW -> catalogue row lookup -> relative weight * LBFW
```

Everything else is secondary.

Do not add abstract catalogue-context APIs, manifest orchestration, broad provenance frameworks, grouping logic, or multi-component reimbursement support until the base lookup path is real, tested, and easy to explain.

The first successful user experience should be:

1. User downloads official public files.
2. User puts them in a documented folder.
3. Engine parses or indexes them locally.
4. User calls `priceBaseDrg({ year, drgCode, lbfw })`.
5. Engine returns amount, formula inputs, and source file/row used.

## Non-goals

- No DRG grouping.
- No ICD-10-GM or OPS interpretation.
- No automatic DRG derivation.
- No certified billing claim.
- No hidden runtime downloads.
- No hidden lookup of local or negotiated monetary values.
- No official data bundled in the public repository unless legal review explicitly allows it.
- No ZE, NUB, Pflege, transfer, readmission, or length-of-stay adjustment support in the first slice.

## Data posture

Official catalogue files may be publicly accessible, but the repo should not assume that public access means redistribution rights.

Default posture:

- The repository ships code, parsers, schemas, examples, and synthetic test fixtures.
- The user supplies official files locally.
- The engine reads from local folders only.
- The engine reports file names, checksums, parser versions, and row identifiers in the response.
- The engine does not silently download official data at runtime.

A private/internal deployment may maintain a preloaded official data folder or private data package if legal/product owners approve that posture separately.

## Minimal official inputs for base DRG pricing

For the first useful product slice, the engine needs:

1. **aG-DRG/Fallpauschalen-Katalog for the reimbursement year**
   - DRG/aG-DRG code.
   - Bewertungsrelation / relative weight.
   - Later: lower/upper trim points if length-of-stay adjustments are added.

2. **Landesbasisfallwert (LBFW)**
   - Caller-supplied as a monetary input for the relevant state/local context.
   - Do not auto-infer it in the first product slice.

Initial formula:

```text
baseDrgAmount = relativeWeight * landesbasisfallwert
```

## Minimal API surface

Start with a single base pricing function:

```ts
type PriceBaseDrgRequest = {
  year: number;
  drgCode: string;
  landesbasisfallwert: string;
  currency?: "EUR";
};
```

Suggested response:

```ts
type PriceBaseDrgResponse = {
  status: "priced" | "not_found" | "unsupported" | "error";
  amount?: {
    value: string;
    currency: "EUR";
  };
  calculation?: {
    formula: "relativeWeight * landesbasisfallwert";
    relativeWeight: string;
    landesbasisfallwert: string;
  };
  source?: {
    year: number;
    file: string;
    checksum: string;
    rowKey: string;
    parserVersion: string;
  };
  errors?: Array<{
    code: string;
    message: string;
  }>;
};
```

Do **not** require request fields such as `sourceManifestId`, `catalogueVersion`, or `ruleVersion` in the MVP API. The engine should derive the source context from the local files it loaded and return it in the response.

If guard semantics are needed later, add an explicitly named optional field such as:

```ts
requireSource?: {
  year?: number;
  checksum?: string;
  catalogueVersion?: string;
};
```

Do not add this until there is a real user need.

## Folder convention

Use a boring local folder layout:

```text
data/
  official/
    2026/
      raw/
        Fallpauschalenkatalog_2026.xlsx
      index/
        base-drg-index.json
      manifest.json
```

Initial implementation may skip persisted indexes and parse at startup, but the public model should remain local-file based.

## Minimal product decisions needed

Before implementation, decide only these:

1. **First supported year**
   - Pick one recent year with accessible official catalogue files.

2. **First accepted source file format**
   - Prefer XLSX if available because it is easier to parse deterministically than PDF.

3. **Data supply model**
   - Public repo does not bundle official files.
   - User downloads files manually into `data/official/{year}/raw/`.

4. **First calculation scope**
   - Base DRG amount only: relative weight times caller-supplied LBFW.

5. **Rounding policy**
   - Define deterministic decimal money rounding for output.
   - Document if this is a product assumption until confirmed against source rules.

6. **Error semantics**
   - Missing file.
   - Unsupported year.
   - Unknown DRG code.
   - Missing/invalid LBFW.
   - Parse failure.

7. **Legal/data posture**
   - Confirm no official raw or parsed data is committed to the public repo without review.

## Minimal ADRs needed

Create only a small ADR set initially. Task 1 created the first accepted decisions:

1. **ADR 0001: KISS base DRG lookup boundary**
   - Request path starts from `year + drgCode + LBFW`.
   - No grouping, ICD/OPS interpretation, billing certification claim, hidden downloads, or hidden
     monetary input lookup.

2. **ADR 0002: Local BYOD official-data posture**
   - Users supply official files locally.
   - No bundled official data by default.
   - No runtime downloads in the core engine.

Likely future ADRs, only when implementation reaches them:

- **Minimal base DRG pricing API**
  - Source/provenance is response output, not required request input.
- **Deterministic decimal money and rounding**
  - No binary floating-point money math.
  - Stable output formatting.
  - Explicit rounding assumption or cited source basis.

Do not create ADRs for future ZE/NUB/Pflege/LOS support until those slices are actually planned.

## Minimal high-level issue backlog draft

### Issue 1: Define product boundary and local data posture

- Write README and ADRs for KISS scope.
- Document no grouping, no hidden downloads, no bundled official data by default.
- Acceptance: a new contributor can explain what the product does in one paragraph.

### Issue 2: Add project skeleton and decimal money primitive

- TypeScript/Node or similarly boring stack.
- Add deterministic decimal multiplication and rounding.
- Add tests for money parsing, multiplication, and formatting.

### Issue 3: Define local official-file folder convention

- Add `data/official/{year}/raw/` convention.
- Add ignored placeholder folders.
- Add manifest/checksum generation command if useful.
- Acceptance: official files remain uncommitted by default.

### Issue 4: Parse first Fallpauschalen-Katalog file

- Support one chosen year and one chosen source format.
- Extract DRG code and relative weight.
- Build an in-memory lookup index.
- Test with tiny synthetic fixture files, not committed official data.

### Issue 5: Implement `priceBaseDrg`

- Input: year, DRG code, LBFW.
- Lookup relative weight.
- Calculate amount deterministically.
- Return formula inputs and source file/row metadata.
- Add unknown-code, unsupported-year, missing-file, and invalid-money tests.

### Issue 6: Add CLI wrapper

- Example:

```bash
drg-pricer price --year 2026 --drg B79Z --lbfw 4200.00 --data ./data/official
```

- Output stable JSON.

### Issue 7: Add documentation and quickstart

- Tell user where to download files.
- Tell user where to place files.
- Show one base pricing example.
- Warn that the tool is experimental and not certified billing software.

### Issue 8: Harden parser/index validation

- Deterministic row ordering.
- Check required columns.
- Helpful parse errors.
- Checksum and parser-version reporting.

### Issue 9: Consider persisted local index

- Optional performance/convenience step.
- Do not add until parsing works reliably.

### Issue 10: Plan next pricing slice

Choose exactly one:

- length-of-stay adjustments,
- Pflege component,
- caller-supplied ZE pass-through,
- multi-year catalogue support.

Do not implement multiple at once.

## Agent implementation guidance

The next agent should optimize for simplicity and user trust.

Prefer:

- one clear API over broad future-proof contracts,
- local file reads over runtime network access,
- explicit user-supplied money inputs over hidden lookup,
- response-side source reporting over request-side catalogue ceremony,
- small deterministic tests over broad unsupported claims,
- synthetic fixtures for tests and user-supplied official files for real runs.

Avoid:

- turning provenance into a public request burden too early,
- building a manifest platform before one catalogue lookup works,
- adding grouping or ICD/OPS logic,
- implying billing readiness,
- committing official data without legal review,
- supporting every German reimbursement component in the first MVP.

## One-line product principle

> Make the first version a boring local official-file lookup calculator: `year + DRG + LBFW` in, deterministic amount plus source row out.
