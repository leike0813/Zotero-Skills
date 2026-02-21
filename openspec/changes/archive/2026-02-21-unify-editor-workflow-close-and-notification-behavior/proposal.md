## Why

Current editor-style workflows (`tag-manager`, `reference-note-editor`) still inherit execution feedback semantics designed for task-style workflows: start/progress/end reminders plus cancel-as-failure framing. This causes UX mismatch for edit dialogs where the core outcome is whether edits were saved.

## What Changes

- Add a manifest-level execution feedback switch so workflows can disable workflow execution reminders (start toast, per-job toast, final summary alert) when success/failure framing is not appropriate.
- Update workflow execution feedback behavior to honor the manifest switch while keeping runtime logging behavior unchanged by default.
- Update workflow editor host close behavior to support dirty-state-aware close confirmation:
  - dirty + close: prompt user to save, discard, or cancel
  - clean + close: close immediately without extra prompt
- Apply the new editor semantics to `tag-manager` and `reference-note-editor`.
- Update `tag-manager` editor title to be workflow-label based only, without appending trigger selection title.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workflow-manifest-authoring-schema`: add schema-level contract for per-workflow execution reminder suppression.
- `workflow-execution-notifications`: make start/progress/end reminder emission conditional by manifest execution feedback config.
- `workflow-editor-host`: change close semantics from unconditional cancel/fail to dirty-aware save/discard/cancel flow.
- `tag-vocabulary-management-workflow`: align tag manager editor UX with editor workflow semantics and remove selection-derived title suffix.
- `reference-note-editor-workflow`: align reference note editor completion semantics with save/discard-oriented editor UX.

## Impact

- Affected code: `src/schemas/workflow.schema.json`, `src/workflows/types.ts`, workflow loader/runtime execution feedback path, workflow editor host, `workflows/tag-manager/hooks/applyResult.js`, `workflows/reference-note-editor/hooks/applyResult.js`, related tests.
- Affected docs/specs: workflow manifest/schema docs and workflow capability specs listed above.
- Runtime compatibility: default behavior remains unchanged unless a workflow opts into the new switch.
