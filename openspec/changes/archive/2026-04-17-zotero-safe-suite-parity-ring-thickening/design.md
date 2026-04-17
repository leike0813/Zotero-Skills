# Design: zotero-safe-suite-parity-ring-thickening

## Model

The existing Zotero routine allowlist becomes two concentric rings:

- `lite allowlist`
  - baseline host smoke
  - plus a minimal parity set for the four highest-value real-host risks
- `full extra allowlist`
  - additional real-host parity and guard/idempotency cases
  - combined with `lite` to form the Zotero `full` gate

Node remains the source of broad depth and matrix coverage.

## Allowlist Resolution

`test/zotero/domainFilter.ts` remains the single decision point.

- `lite` mode uses `ZOTERO_LITE_ALLOWLIST` and `ZOTERO_LITE_TITLE_ALLOWLIST`
- `full` mode uses `lite + full-extra`
- test titles remain the primary selector when available
- file-path allowlists remain the fallback when the real Zotero browser runtime
  does not expose `currentTest.file`

This preserves the current runner and pruning mechanism while giving `full` a
strict superset contract.

## Retained Coverage Shape

### Lite additions

- `core`
  - `selection-context rebuild` top-3 fixture
  - `job-queue transport integration`
- `ui`
  - registry rescan
  - context-menu selection/disabled behavior
  - pass-through menu enablement
- `workflow`
  - digest idempotent skip
  - mineru sibling-markdown conflict filtering
  - tag-regulator buildRequest -> applyResult conservative mutation path

### Full-only additions

- `core`
  - full `selection-context-mix-all`
  - job queue progress request/deferred/request-created non-terminal cases
  - selected task reconciler host parity paths
- `ui`
  - selected workflow settings persisted/provider/pass-through cases
  - selected local backend control/status cases
- `workflow`
  - selected explainer/result-shape guard
  - selected workbench export codec guard
  - selected reference-matching idempotent parent-link guard
  - selected tag-regulator pre-dialog guard

## Non-goals

- No change to Node suite depth
- No change to test.entries, runner, bundling, or watch behavior
- No reintroduction of editor/picker/dialog/GitHub-sync/mock-e2e classes into
  Zotero routine suites
