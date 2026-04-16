## Why

The current test-governance narrative has drifted away from the repository's
actual operating model.

- the old Tier framing no longer matches how suites are executed
- the real execution axes are `lite/full` plus runtime affinity
- several completed governance changes are not yet captured in OpenSpec
- three remaining giant files still make review and regression triage harder

This change records the already-completed governance realignment and finishes
the remaining giant-file splits without introducing a new runner or changing
the current `npm run test:*` / `itFullOnly` mechanisms.

## What Changes

- Create change `test-governance-three-axis-realignment`
- Record the revised three-axis governance rules in OpenSpec
- Capture the first batch of completed parameterization merges
- Capture the first batch of completed `full-only` / `node-only` /
  `zotero-safe` runtime-affinity adjustments
- Split the remaining giant files:
  - `70-skillrunner-task-reconciler.test.ts`
  - `73-skillrunner-local-runtime-manager.test.ts`
  - `64-workflow-tag-regulator.test.ts`

## Capabilities

### Modified Capabilities

- `test-suite-gating-strategy`
  - clarifies `lite/full` rules and formalizes case-level `itFullOnly`
- `test-taxonomy-domain-grouping`
  - adds runtime-affinity classification alongside existing domain grouping

### New Capabilities

- `test-runtime-affinity-governance`
  - defines `node-only`, `zotero-safe`, and `zotero-unsafe` expectations

## Impact

- Updates governance documents in `artifact/` and `doc/`
- Keeps existing test execution entrypoints intact
- Finishes the remaining giant-file physical splits
- Tightens Zotero-safe constraints so editor/picker/dialog tests do not enter
  normal Zotero regression runs
