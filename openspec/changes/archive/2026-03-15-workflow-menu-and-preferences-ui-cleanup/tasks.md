## 1. OpenSpec Artifacts

- [x] 1.1 Create `proposal/design/spec/tasks` for `workflow-menu-and-preferences-ui-cleanup`
- [x] 1.2 Add spec deltas for `workflow-settings-per-workflow-page` and `log-viewer-window`

## 2. Workflow Context Menu Cleanup

- [x] 2.1 Remove `Rescan Workflows` entry from workflow context menu
- [x] 2.2 Remove `Workflow Settings...` submenu entry from workflow context menu
- [x] 2.3 Remove `Open Logs...` entry from workflow context menu
- [x] 2.4 Keep `Open Dashboard...` + workflow execution entries only

## 3. Preferences UI Cleanup

- [x] 3.1 Remove redundant top headings in preferences page
- [x] 3.2 Introduce card-style section layout with stronger section titles
- [x] 3.3 Add `Open Log Viewer` button in workflow section
- [x] 3.4 Bind `Open Log Viewer` button to `openLogViewer` prefs event

## 4. Tests and Validation

- [x] 4.1 Update workflow context-menu tests for new structure
- [x] 4.2 Add/update preferences test for workflow-section `Open Log Viewer` button dispatch
- [x] 4.3 Update startup menu initialization tests for new menu layout
- [x] 4.4 Run `npx tsc --noEmit`
- [x] 4.5 Run targeted tests:
  - `test/ui/40-gui-preferences-menu-scan.test.ts`
  - `test/ui/01-startup-workflow-menu-init.test.ts`
- [x] 4.6 Run `openspec validate workflow-menu-and-preferences-ui-cleanup --type change --strict --no-interactive`
