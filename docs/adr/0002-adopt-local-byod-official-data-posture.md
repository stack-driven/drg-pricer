# ADR 0002: Adopt local BYOD official-data posture

## Status

Accepted, 2026-05-17.

## Context

The first product slice depends on official Fallpauschalen-Katalog files. Those artifacts may be
publicly accessible, but public access is not the same as permission to redistribute raw files,
parsed tables, small real-value extracts, or real-value golden fixtures from this repository.

`../drg-pricer` uses a bring-your-own-data and no-redistribution posture. `drg-price-lookup` adopts
that posture in a simpler form: local official files are user-supplied, and the public repo remains
safe by default.

## Decision

`drg-price-lookup` will use a local bring-your-own-data (BYOD) model for official artifacts.

Concrete rules:

- Users obtain official artifacts themselves.
- Official files are stored in documented local paths that are ignored by version control.
- Runtime pricing reads local files only and must not perform hidden official-data downloads.
- The public repository may include code, schemas, parsers, placeholder manifests, examples, and
  synthetic fixtures.
- Raw official files, parsed official datasets, normalized official tables, real-value extracts, and
  real-value golden fixtures require legal/data review before publication.
- Once parser/indexing exists, outputs should report file name, checksum, parser version, and row
  identifier for the source value used.

The initial local folder convention is `data/official/{year}/raw/`, where `{year}` is the
reimbursement/catalogue year and `raw/` contains user-supplied original official files.

## Rationale

This posture keeps the repository useful without assuming redistribution rights. It also protects
reproducibility: users can pin exactly which local file produced a calculation, and future outputs
can point back to checksums and row identifiers.

Avoiding hidden downloads keeps the core deterministic, testable offline, and easy to audit.

## Consequences

Positive consequences:

- The public repository can safely start before legal review of official artifacts.
- Users remain in control of their official files and local monetary inputs.
- Parser tests can rely on synthetic fixtures.
- Future source metadata can connect outputs to local files without bundling those files.

Trade-offs:

- New users must download official files themselves.
- The project cannot offer turnkey official catalogue data by default.
- Parser and CLI errors must be clear when expected local files are missing.

## Alternatives considered

### Bundle official raw files

Rejected. Redistribution status must be reviewed before any official raw file is committed or
published.

### Bundle parsed official JSON or CSV

Rejected. Derived official values can carry the same legal and attribution concerns as raw files.
They also risk becoming stale without source metadata.

### Download official data during pricing

Rejected. Hidden runtime downloads weaken determinism, offline operation, reproducibility, and user
trust.
