## 1. Manifest Contract And Runtime Feedback Switch

- [x] 1.1 Extend workflow manifest schema/type definitions to support `execution.feedback.showNotifications` as an optional boolean.
- [x] 1.2 Add runtime helper to resolve workflow reminder policy with default `true` when unset.
- [x] 1.3 Gate workflow reminder emitters (`emitWorkflowStartToast`, `emitWorkflowJobToasts`, `emitWorkflowFinishSummary`) in `executeWorkflowFromCurrentSelection` completion/early-exit branches by the resolved policy.
- [x] 1.4 Add/adjust tests for schema validation and workflow execution reminder suppression behavior.

## 2. Workflow Editor Host Dirty-Close Semantics

- [x] 2.1 Implement host-level dirty detection between initial and current editor state.
- [x] 2.2 On non-save close, add save/discard/cancel confirmation for dirty sessions and keep immediate close for clean sessions.
- [x] 2.3 Ensure save-via-close path returns `{ saved: true, result }`, discard path returns explicit not-saved reason, and cancel path keeps editor open.
- [x] 2.4 Update editor-host unit tests for clean-close, dirty-close-save, dirty-close-discard, dirty-close-cancel-continue, and sequential-session stability.

## 3. Apply To Editor Workflows

- [x] 3.1 Update `workflows/tag-manager/workflow.json` and `workflows/reference-note-editor/workflow.json` to opt into reminder suppression.
- [x] 3.2 Update tag-manager hook title logic to remove selection-derived title suffix and use workflow label only.
- [x] 3.3 Add/adjust integration tests for tag-manager and reference-note-editor to assert no start/progress/end reminders while preserving save/discard effects.

## 4. Documentation And Verification

- [x] 4.1 Update workflow manifest authoring docs to document `execution.feedback.showNotifications` and default behavior.
- [x] 4.2 Run targeted test suites plus required type checks and fix regressions.
- [x] 4.3 Verify OpenSpec artifacts are consistent and mark change as apply-ready.
