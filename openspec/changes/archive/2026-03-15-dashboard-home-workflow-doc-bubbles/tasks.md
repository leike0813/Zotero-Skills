## 1. OpenSpec Artifacts

- [x] 1.1 Create `proposal/design/spec/tasks` for `dashboard-home-workflow-doc-bubbles`
- [x] 1.2 Add spec delta for `task-runtime-ui`

## 2. Host Snapshot and Actions

- [x] 2.1 Extend dashboard snapshot with `homeWorkflows` and `homeWorkflowDocView`
- [x] 2.2 Add actions: `open-home-workflow-doc`, `close-home-workflow-doc`, `open-home-workflow-settings`
- [x] 2.3 Keep home-doc route inside `home` tab and support workflow-options jump

## 3. Dashboard Home Rendering

- [x] 3.1 Render workflow bubbles section above task summary
- [x] 3.2 Render per-workflow doc/settings buttons with configurable guard
- [x] 3.3 Render embedded README doc view with back-to-home action
- [x] 3.4 Apply compact bubble layout invariants (content-width + nowrap + wrap-on-overflow)

## 4. Locale

- [x] 4.1 Add home workflow section and README-view locale keys (`en-US` / `zh-CN`)

## 5. Tests and Validation

- [x] 5.1 Run `npx tsc --noEmit`
- [x] 5.2 Run targeted test: `test/core/79-dashboard-home-workflow-doc-bubbles.test.ts`
- [x] 5.3 Run `npx openspec validate dashboard-home-workflow-doc-bubbles --type change --strict --no-interactive`
