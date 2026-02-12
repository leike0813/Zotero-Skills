## 1. OpenSpec Artifacts

- [x] 1.1 Draft proposal for reference payload editor workflow
- [x] 1.2 Draft design for local modal editing and rewrite contract
- [x] 1.3 Add capability spec for input legality, editor behavior, and save/cancel semantics

## 2. Workflow Implementation (TDD)

- [x] 2.1 Add tests for input filtering parity with reference-matching (direct note + parent expansion)
- [x] 2.2 Add tests for sequential multi-input editor window flow with parent context hint
- [x] 2.3 Add tests for edit/add/delete/reorder persistence after save
- [x] 2.4 Add tests for cancel/close without save -> failed job and no note changes
- [x] 2.5 Add `workflows/reference-note-editor/workflow.json` with `pass-through.run.v1`
- [x] 2.6 Implement `workflows/reference-note-editor/hooks/filterInputs.js`
- [x] 2.7 Implement `workflows/reference-note-editor/hooks/applyResult.js`
- [x] 2.8 Implement modal editor UI module for references payload editing

## 3. Validation

- [x] 3.1 Run `npm run build`
- [x] 3.2 Run focused node tests for new workflow/editor
- [x] 3.3 Update workflow documentation (`doc/components/workflows.md`) for the new editor workflow
