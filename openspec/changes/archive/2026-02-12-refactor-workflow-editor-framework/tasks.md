## 1. Editor Host Foundation

- [x] 1.1 Add generic workflow editor host module in core to manage dialog lifecycle and save/cancel resolution
- [x] 1.2 Define renderer contract and renderer registry/dispatch by renderer id
- [x] 1.3 Add sequential multi-input session orchestration in host (one dialog at a time)
- [x] 1.4 Add explicit error propagation for missing or broken renderer resolution

## 2. Reference Renderer Refactor

- [x] 2.1 Move reference-note editor business UI logic out of core module into workflow-side renderer assets/modules
- [x] 2.2 Wire `workflows/reference-note-editor/hooks/applyResult.js` to invoke host + renderer id contract
- [x] 2.3 Keep payload/table rewrite save path unchanged in behavior and keep cancel path as failed job with no write
- [x] 2.4 Add temporary compatibility shim only if needed and remove core-coupled editor business logic after migration

## 3. UI/UX Corrections

- [x] 3.1 Set usable default window size and minimum size so all key editor controls are visible at open
- [x] 3.2 Implement obvious scroll container for long reference lists without unbounded dialog growth
- [x] 3.3 Apply compact row-strip layout: index left, inline action icons right, balanced field widths
- [x] 3.4 Ensure `Raw Text` field is always visible and editable, and hide editable `ID` from default form area

## 4. Tests and Validation (TDD)

- [x] 4.1 Add/adjust tests for host lifecycle (save success, cancel failure, cleanup)
- [x] 4.2 Add/adjust tests for renderer dispatch and renderer-load failure reporting
- [x] 4.3 Add/adjust tests for reference renderer layout behaviors and row operations (edit/add/delete/reorder)
- [x] 4.4 Add/adjust tests for sequential multi-input sessions with parent context hints
- [x] 4.5 Run `npm run build` and focused tests for reference-note editor workflow

## 5. Documentation

- [x] 5.1 Update workflow/component docs to describe host+renderer architecture and extension path for new workflow editors
- [x] 5.2 Document migration notes for existing reference-note-editor behavior parity and known constraints
