# ADR 0001: Adopt KISS base DRG lookup boundary

## Status

Accepted, 2026-05-17.

## Context

German DRG reimbursement can expand into grouping, clinical-code interpretation, local monetary
lookup, multiple reimbursement components, annual rule variations, and certification questions. The
first useful `drg-price-lookup` slice needs to avoid that breadth and prove one auditable path.

The existing product philosophy defines the primitive:

```text
YEAR + DRG CODE + LBFW -> catalogue row lookup -> relative weight * LBFW
```

`../drg-pricer` already documents a broader pricing-only boundary. This project adopts the same
safety principle, but narrows it further to a local base DRG lookup.

## Decision

`drg-price-lookup` will start as a base DRG lookup and pricing helper for already-known DRG/aG-DRG
codes.

The first supported product path is:

1. User supplies official catalogue files locally.
2. User supplies `year`, `drgCode`, and `lbfw`.
3. The engine finds the matching catalogue row for that year and DRG code.
4. The engine returns `relativeWeight * lbfw`, formula inputs, and source file/row metadata.

The following are out of scope until explicitly accepted by a later ADR:

- DRG grouping or automatic DRG derivation.
- ICD-10-GM, OPS, diagnoses, procedures, or clinical-code interpretation.
- Hidden downloads or hidden local-value lookup.
- Automatic estimation of missing LBFW or negotiated monetary values.
- ZE, NUB, Pflege, transfer, readmission, or length-of-stay adjustments.
- Certified billing, claim submission, or legal/reimbursement advice.

Unsupported inputs must fail explicitly instead of being silently approximated.

## Rationale

A narrow boundary makes the first implementation testable, explainable, and reviewable. It lets
contributors focus on deterministic decimal money handling, one catalogue parser, one lookup path,
and clear source metadata before adding additional German reimbursement rules.

This also gives future agents a hard stop condition: if a request asks for grouping, hidden values,
certification, or unsupported reimbursement components, it must be rejected, narrowed, or routed to a
new decision before implementation.

## Consequences

Positive consequences:

- A new contributor can describe the product in one paragraph.
- The first API can stay small: `year`, `drgCode`, `lbfw` in; amount plus source metadata out.
- Parser and money tests can be synthetic and deterministic.
- The public docs can clearly state what the product refuses to infer.

Trade-offs:

- The MVP will not be a complete reimbursement engine.
- Users must already know the DRG/aG-DRG code and relevant LBFW.
- Later features need explicit scope decisions before they can expand the boundary.

## Alternatives considered

### Build a combined grouper and pricer

Rejected. Grouping requires clinical-code interpretation and a much larger certified-rule surface.
It would obscure the first local catalogue lookup path.

### Accept clinical inputs and ignore them

Rejected. Accepting ICD/OPS or clinical facts while ignoring them would invite false confidence and
make outputs harder to explain.

### Estimate missing local monetary values

Rejected. Hidden estimates undermine determinism and source transparency. Missing monetary inputs
must remain caller-visible errors or unsupported cases.
