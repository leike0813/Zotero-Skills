## 1. OpenSpec Artifacts

- [x] 1.1 Create `proposal/design/spec/tasks` for `toolbar-execute-workflow-menu-button`
- [x] 1.2 Add spec delta for `task-runtime-ui`

## 2. Shared Workflow Popup Builder

- [x] 2.1 Extract and export reusable workflow popup rebuild logic from `workflowMenu`
- [x] 2.2 Keep context-menu behavior unchanged by enabling task-manager item in context mode
- [x] 2.3 Support toolbar mode that excludes task-manager/dashboard menu entry

## 3. Toolbar Execute Button

- [x] 3.1 Add `Execute Workflow` toolbar icon menu button with `icon_play.png`
- [x] 3.2 Insert execute button immediately after `zotero-tb-note-add` when available
- [x] 3.3 Keep Dashboard button insertion before search anchor
- [x] 3.4 Ensure cleanup removes both execute and dashboard buttons

## 4. Locale

- [x] 4.1 Add execute-workflow toolbar tooltip locale key (`en-US` / `zh-CN`)

## 5. Tests and Validation

- [x] 5.1 Update toolbar button unit tests for dual-button injection and placement
- [x] 5.2 Add test for execute menu popup empty-state behavior (no dashboard entry)
- [x] 5.3 Run `npx tsc --noEmit`
- [x] 5.4 Run targeted tests:
  - `test/core/64-dashboard-toolbar-button.test.ts`
  - `test/ui/01-startup-workflow-menu-init.test.ts`
  - `test/ui/40-gui-preferences-menu-scan.test.ts`
- [x] 5.5 Run `openspec validate toolbar-execute-workflow-menu-button --type change --strict --no-interactive`
