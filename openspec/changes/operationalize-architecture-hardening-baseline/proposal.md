## Why

`doc/architecture-hardening-baseline.md` already defines debt signals and a dependency-ordered hardening backlog, but it is still a static analysis artifact.  
We need an operational planning layer that translates HB-01~HB-09 into concrete executable OpenSpec changes with sequencing, ownership, and acceptance gates.

## What Changes

- Define a standard interpretation method for reading and using the architecture hardening baseline.
- Build an HB-to-change mapping matrix:
  - identify which HB items are already covered by existing in-progress changes,
  - identify which HB items require new dedicated changes.
- Define execution waves and dependency rules for those concrete changes.
- Define per-change minimum acceptance gates inherited from the baseline checklist.
- Define review/traceability rules to ensure each downstream change references baseline work items.

## Capabilities

### New Capabilities

- `architecture-hardening-change-operationalization`: Defines how baseline HB items are interpreted, decomposed, mapped, and governed as executable OpenSpec changes.

### Modified Capabilities

- None.

## Impact

- Affects OpenSpec planning/governance artifacts under `openspec/changes/`.
- Produces a concrete, executable change portfolio for M3->M4 hardening.
- No runtime code or plugin behavior is modified in this change.

