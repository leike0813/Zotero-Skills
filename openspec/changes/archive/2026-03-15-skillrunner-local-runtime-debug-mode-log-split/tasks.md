## 1. OpenSpec Artifacts

- [x] 1.1 Create change artifacts (`proposal/design/spec/tasks`)
- [x] 1.2 Add component document for debug-mode and log-split behavior

## 2. Debug Mode SSOT

- [x] 2.1 Add hardcoded debug mode module with test override seam
- [x] 2.2 Gate debug console store append/reset behavior with debug mode

## 3. Persistent Log Split

- [x] 3.1 Extend local runtime manager logging to write key milestones into runtime logs
- [x] 3.2 Implement whitelist and monitoring/polling exclusions for persistent logs

## 4. UI/Menu Gating

- [x] 4.1 Hide preferences debug console button and skip binding when debug mode is off
- [x] 4.2 Gate selection sample/validate menu registration by debug mode
- [x] 4.3 Gate prefs event `openSkillRunnerLocalDeployDebugConsole` when debug mode is off

## 5. Tests and Verification

- [x] 5.1 Add/adjust core tests for whitelist filtering and debug-store gating
- [x] 5.2 Add/adjust UI tests for preferences debug button visibility/dispatch gating
- [x] 5.3 Add/adjust tests for selection debug menu registration gating
- [x] 5.4 Run `npx tsc --noEmit`
- [x] 5.5 Run targeted tests:
  - `test/core/73-skillrunner-local-runtime-manager.test.ts`
  - `test/ui/40-gui-preferences-menu-scan.test.ts`
  - `test/core/59-selection-sample-risk-regression.test.ts`
- [x] 5.6 Run `openspec validate skillrunner-local-runtime-debug-mode-log-split --type change --strict --no-interactive`
