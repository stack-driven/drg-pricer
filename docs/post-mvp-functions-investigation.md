# Post-MVP functions investigation

Date: 2026-05-17

## Boundary reminder

Keep future functions anchored to the accepted primitive:

```text
YEAR + DRG CODE + LBFW -> catalogue row lookup -> relative weight * LBFW
```

Post-MVP functions may make local lookup more useful, easier to audit, or easier to compare, but
they must not infer missing inputs. The caller still supplies the DRG/aG-DRG code and all monetary
inputs, and official catalogue files remain local bring-your-own-data inputs.

Do not add these as part of this investigation:

- DRG grouping or automatic DRG derivation.
- ICD/OPS, diagnosis, procedure, or clinical-code interpretation.
- Hidden downloads of official files or hidden lookup of LBFW/negotiated monetary values.
- Billing advice, certification claims, or complete reimbursement calculations.
- ZE, NUB, Pflege, transfer, readmission, length-of-stay, or other adjustment logic without a
  separate scoped slice and ADR.

## Recommendation summary

1. **Catalogue metadata command/API** — best next function. It stays fully local and exposes what
   the tool already needs to know: supported years, parser versions, row counts, local source files,
   and checksums.
2. **Provenance/audit report for one lookup** — useful immediately after pricing. It packages the
   existing priced response, formula inputs, source row metadata, parser version, and checksum into a
   small reproducibility report. It must explicitly say it is not a certified billing document.
3. **Same-DRG year comparison** — useful once metadata/reporting exists. Compare one already-known
   DRG across locally available supported years using either one caller-supplied hypothetical LBFW or
   explicit caller-supplied LBFW values per year.
4. **Amount-difference explanation** — useful as a companion to year comparison. Explain only the
   base formula delta: relative-weight change, caller-supplied LBFW change, and resulting base amount
   change.
5. **Pricing-complexity slices** — defer. Length-of-stay, Pflege, ZE/NUB, transfer/readmission, and
   similar components should remain outside this lookup primitive unless one is selected as a
   separate future slice with its own source review, product boundary, tests, and ADR.

## Candidate evaluations

### 1. Catalogue metadata command/API

Possible shape:

```text
node dist/src/cli.js metadata --data-dir data/official
```

or a small library function such as `describeLocalCatalogues({ dataDirectory })`.

Output should be stable JSON with only local facts:

- supported parser years and parser versions compiled into this package;
- discovered local files under `data/official/{year}/raw/`;
- file checksum for each discovered parser-readable file;
- parser-readable row count after applying the same base-lookup row filters;
- parser errors for local files that look relevant but cannot be parsed.

Why it fits:

- Helps users verify local setup before pricing.
- Strengthens auditability without widening pricing semantics.
- Reuses parser and checksum behavior already needed for `priceBaseDrg`.

Cautions:

- Do not download missing catalogues.
- Do not commit generated metadata for official files by default.
- Do not call a year “complete” beyond what the local parser actually supports.

### 2. Provenance/audit report for one lookup

Possible shape:

```text
node dist/src/cli.js --year 2025 --drg B79Z --lbfw 4000.00 --audit
```

The report can be JSON first, with optional Markdown later if a user asks for human-readable export.
It should include:

- request inputs: year, normalized DRG code, caller-supplied LBFW, currency;
- formula: `relativeWeight * landesbasisfallwert`;
- output amount and rounding/formatting behavior already used by the core API;
- source file path, checksum, parser version, row key, and source row number;
- explicit limitations: base DRG amount only, not billing advice, no grouping, no adjustments.

Why it fits:

- Builds directly on the existing priced response.
- Makes provenance easier to save or attach to local work notes.
- Does not require new official data or reimbursement rules.

Cautions:

- Name it “audit/provenance report,” not “invoice,” “claim,” or “certification.”
- Keep it deterministic and local; avoid timestamps unless clearly marked as report-generation
  metadata.

### 3. Same-DRG comparison across years

Possible shape:

```text
node dist/src/cli.js compare --drg A01A --years 2024,2025,2026 --lbfw 4000.00
```

or, if real-world year-specific monetary inputs are needed:

```text
node dist/src/cli.js compare --drg A01A --year-lbfw 2024=3900.00 --year-lbfw 2025=4000.00
```

Output should make the assumptions visible:

- whether one hypothetical LBFW was reused for every year or a separate caller-supplied LBFW was
  used per year;
- per-year relative weight, caller-supplied LBFW, calculated base amount, and source metadata;
- missing-year or missing-DRG rows as explicit `not_found`/`unsupported` entries, not interpolated
  values.

Why it fits:

- Uses existing local catalogue lookup repeatedly.
- Helps answer “what changed in the base catalogue row?” without claiming full reimbursement
  comparison.

Cautions:

- Never auto-fetch historical catalogues or LBFW values.
- Label single-LBFW comparisons as hypothetical or caller-normalized comparisons.
- Do not imply that differences explain complete hospital reimbursement.

### 4. Base amount difference explanation

Possible shape:

```text
node dist/src/cli.js compare --drg A01A --years 2025,2026 --lbfw 4000.00 --explain
```

The explanation should decompose only the current formula:

```text
amountDelta = (relativeWeightB * lbfwB) - (relativeWeightA * lbfwA)
```

When a single LBFW is reused, the explanation can attribute the amount delta only to relative-weight
changes under that caller-supplied hypothetical. When per-year LBFWs are supplied, it can show the
separate caller-supplied LBFW difference and relative-weight difference, but should avoid causal
language beyond arithmetic.

Why it fits:

- Gives useful context without adding reimbursement rules.
- Is testable with synthetic catalogues and deterministic money values.

Cautions:

- Say “base amount difference,” not “reimbursement difference.”
- Do not mention coding, grouping, length-of-stay, transfer, Pflege, ZE/NUB, or readmission effects
  except as explicit out-of-scope limitations.

### 5. Pricing-complexity components as separate slices

Length-of-stay, Pflege, ZE/NUB, transfer/readmission, and similar logic should not be bolted onto the
base lookup flow. If one becomes necessary, select exactly one slice and first document:

- source documents and redistribution posture;
- required caller inputs;
- formulas/rules and year-specific variation;
- unsupported edge cases;
- output wording that avoids billing/certification claims;
- whether a new ADR is needed because the product boundary changes.

Until then, keep these components deferred and visible as unsupported behavior.

## Suggested next implementation order

1. Implement catalogue metadata as a read-only local inspection command/API.
2. Add a provenance/audit report export for one already-supported lookup.
3. Add same-DRG comparison across supported local years.
4. Add arithmetic-only difference explanations on top of comparison output.
5. Revisit one pricing-complexity component only when there is a concrete use case and a new scoped
   decision.

## Documentation rule for future tasks

Each future implementation task should state whether it preserves the base lookup boundary or changes
it. Boundary-preserving tasks can cite ADR 0001 and ADR 0002. Boundary-expanding tasks need a new ADR
before code is added.
