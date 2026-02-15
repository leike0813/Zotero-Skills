# Test Suite Governance

## 1. Suite Membership Policy

`lite` policy:

- Must protect PR critical path
- Must prefer deterministic and fast-running tests
- May exclude deep regression cases that do not materially change PR decision quality

`full` policy:

- Must include all `lite` tests
- Adds depth, environment-heavy, and low-frequency regression tests

Guardrail:

- `full` is a strict superset of `lite`

## 2. Lite-Pruning Inventory

Moved/kept as full-only:

- `test/core/10-selection-context-schema.test.ts`
- `test/core/12-handlers.test.ts`
- `test/core/32-job-queue-transport-integration.test.ts`
- `test/core/34-generic-http-provider-e2e.test.ts`
- `test/workflow-literature-digest/23-workflow-literature-digest-fixtures.test.ts`
- `test/workflow-literature-digest/50-workflow-literature-digest-mock-e2e.test.ts`

Case-level full-only (kept in same file, gated via `itFullOnly`):

- `test/workflow-reference-matching/24-workflow-reference-matching.test.ts`
  - BBT-lite template failure/ambiguity edges
  - BBT JSON-RPC connectivity and failure-path checks
  - title-major fuzzy/ambiguous ranking edge matrix
- `test/workflow-literature-digest/21-workflow-literature-digest.test.ts`
  - legacy note-shape compatibility matrix
  - upsert/partial-fallback and all-skipped edge accounting
- `test/workflow-mineru/39-workflow-mineru.test.ts`
  - `attachments:`/`attachment:`/slash-parse compatibility fallbacks
  - orphan-images replacement and missing-`full.md` failure handling
- `test/ui/40-gui-preferences-menu-scan.test.ts`
  - submenu bubble guard and low-risk task/log command branches

Rationale:

- Execution cost is relatively high compared with PR feedback value
- Coverage is still retained in `full` gate
- Critical-path smoke confidence remains in `lite`

## 3. Selection-Context Rebuild Governance

Lite scope:

- Uses fixture derived from the first three parents of `selection-context-mix-all`
- Excludes standalone notes
- Keeps rebuilt artifacts for diagnosis

Full scope:

- Runs comprehensive rebuild matrix

## 4. Domain Group Command Governance

Supported grouped command level:

- First-level domains only: `core`, `ui`, `workflow`

Out of scope in this phase:

- Per-workflow grouped command variants

## 5. CI Gate Governance

Blocking gates:

- PR -> `test:gate:pr` (`lite`)
- release/main -> `test:gate:release` (`full`)

Reporting:

- Gate scripts print explicit start/end/failure status and keep blocking semantics tied to exit code.
