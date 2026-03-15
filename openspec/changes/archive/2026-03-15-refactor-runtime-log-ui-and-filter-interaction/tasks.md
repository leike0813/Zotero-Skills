## 1. OpenSpec Artifacts
- [x] 1.1 Define `2026-03-15-refactor-runtime-log-ui-and-filter-interaction` change proposal/design/tasks
- [x] 1.2 Retroactively update `log-viewer-window` requirements to include multi-select behavior, stability requirements (incremental DOM), and action feedback (Toasts).
- [x] 1.3 Create delta spec documentation in `specs/` directory within the change bundle for `log-viewer-window` and `task-runtime-ui`.

## 2. Shared Component Enhancement
- [x] 2.1 Extend `custom-select.js` to support multi-select via checkboxes
- [x] 2.2 Implement `document` click listener for automatic menu collapse
- [x] 2.3 Implement `closeMenuAndApply` closure to bridge drafting state with final action dispatch
- [x] 2.4 Add dynamic trigger text logic (None / All / Label / Count)

## 3. Log Dashboard Refactoring (app.js)
- [x] 3.1 Implement targeted DOM replacement zones (`.logs-action-wrap`, `.logs-context-wrap`) to maintain toolbar interaction state
- [x] 3.2 Implement `showToast` system for asynchronous operation feedback
- [x] 3.3 Add Backend/Workflow dropdowns to the filter wrap
- [x] 3.4 Implement "Select All" default visualization and payload normalization (`undefined` for total selection)

## 4. State & Backend Integration
- [x] 4.1 Update `runtimeLogManager.ts` to process `string | string[]` filter inputs
- [x] 4.2 Enhance `taskManagerDialog.ts` snapshot builder to resolve technical IDs into human-readable `{ value, label }` pairs
- [x] 4.3 Link `task-dashboard-runtime-logs-copy-diagnostic-bundle` localization to the snapshot labels library

## 5. Verification
- [x] 5.1 Verify menu stability during high-frequency log updates
- [x] 5.2 Verify outside-click behavior and batch-apply logic
- [x] 5.3 Verify localization of all new dashboard widgets and toast messages
- [x] 5.4 Build and verify bundle packing in production mode
