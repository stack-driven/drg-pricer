# ADR 0003: Adopt 2026 reimbursement-engine scope

## Status

Accepted, 2026-05-17.

## Context

The MVP already implements a narrow, auditable base DRG lookup:

```text
YEAR + DRG CODE + LBFW -> catalogue row lookup -> relative weight * LBFW
```

The next reimbursement-engine work adds more German inpatient reimbursement components. Without a
scope decision, “full reimbursement” could blur into grouping, clinical-code interpretation,
production billing, legal advice, hidden local-value lookup, or multi-year rule expansion before one
complete annual path is validated.

The follow-up implementation plan therefore needs one first full-scope year and a clear boundary that
preserves ADR 0001's no-grouping stance and ADR 0002's local BYOD official-data posture.

## Decision

`drg-price-lookup` will treat 2026 as the first full-scope reimbursement-engine year.

The 2026 reimbursement-engine input starts from either:

- an already-known 2026 DRG/aG-DRG code supplied by the caller; or
- the result of a separate external grouper supplied by the caller.

This repository will not build DRG grouping, ICD-10-GM or OPS interpretation, clinical-code
interpretation, grouper certification, claim submission, or billing certification as part of this
scope.

The 2026 output is an itemized reimbursement candidate. It is not an invoice, claim, certified
billing result, reimbursement advice, legal advice, or production-approved amount unless later
production, legal, and certification work explicitly accepts stronger language.

The first supported 2026 component set is:

- base DRG or department-specific DRG amount;
- length-of-stay deductions and surcharges;
- transfer effects;
- readmission and case-merge handling;
- Pflege component;
- nationally priced Zusatzentgelte;
- caller-supplied negotiated ZE/NUB amounts; and
- explicitly supported statutory or local adjustments.

Official 2026 data remains bring-your-own-data: users obtain official artifacts themselves, store
them locally in ignored paths, and the runtime must not perform hidden official-data downloads. Raw
official files, parsed official datasets, real-value extracts, and real-value golden fixtures remain
out of git unless a later legal/data review approves publication.

Caller-supplied values remain required where the official national files do not provide a value for
this tool, including LBFW, Pflegeentgeltwert, negotiated ZE/NUB amounts, quantities, and relevant case
context. Missing, unsupported, or ambiguous inputs must produce explicit `unsupported` or partial
candidate responses instead of silent estimates.

## Rationale

Choosing 2026 first gives the project one concrete annual rule set to inventory, model, parse, test,
and explain before generalizing to other years.

Starting from a known DRG/aG-DRG or external grouper result keeps the full-scope engine aligned with
the existing no-grouping product boundary. The tool can calculate and explain a reimbursement
candidate from declared facts without pretending to derive those facts from clinical inputs.

Candidate wording protects users and contributors from overclaiming. Itemization and provenance make
component-level review possible while leaving production, legal, and certification decisions to a
separate workflow.

## Consequences

Positive consequences:

- Tasks for the 2026 source inventory, model, parsers, calculations, audit output, CLI/API surface,
  and validation suite can proceed against a stable scope.
- The existing base lookup API can remain stable while full reimbursement work uses a separate 2026
  case-pricing path.
- Official-source provenance and caller-supplied monetary inputs remain visible in outputs.
- Unsupported cases can be represented honestly instead of approximated.

Trade-offs:

- The 2026 engine will still depend on external grouping or already-known DRG/aG-DRG inputs.
- Some real 2026 cases will remain unsupported until their required sources, local values, and case
  context are modeled.
- Other reimbursement years remain out of full-scope implementation until 2026 proves the path and a
  later decision or task extends it.

## Alternatives considered

### Build grouping in this repository

Rejected. Grouping requires clinical-code interpretation and a much larger certification-sensitive
rule surface. It would break the existing boundary before the pricing side is validated.

### Implement all reimbursement years at once

Rejected. Multi-year expansion would multiply source inventory, parsing, rule, and validation work
before the project has one complete end-to-end reimbursement candidate path.

### Produce certified billing output now

Rejected. Certification, production billing, claim submission, and legal/reimbursement advice require
separate review and evidence. The current scope is an auditable candidate calculation.

### Estimate missing local or negotiated values

Rejected. Hidden estimates for LBFW, Pflegeentgeltwert, negotiated ZE/NUB, quantities, or local
adjustments would undermine determinism and provenance. Missing inputs must stay explicit.
