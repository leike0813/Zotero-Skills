## Why

`HB-04` requires workflow settings logic to be decoupled from UI/dialog orchestration.  
Current settings code is functionally correct but mixes:

- persistence IO,
- schema normalization,
- workflow-specific param validation,
- run-once snapshot/default semantics,
- dialog consumption wiring.

This coupling raises regression risk when changing settings UX or adding new workflow/provider options.

## What Changes

- Extract a workflow settings domain layer with explicit contracts for:
  - loading persisted settings,
  - producing dialog-ready initial models,
  - validating and normalizing persistent/run-once payloads,
  - producing execution-ready merged settings.
- Keep dialog module focused on rendering + user interaction only.
- Preserve current user-visible behavior, especially:
  - run-once defaults reset from persisted values on each open,
  - profile/provider/workflow parameter precedence semantics,
  - existing validation fallback behavior (including reference-matching template handling).
- Add regression tests for domain contracts and integration parity.

## Capabilities

### New Capabilities

- `workflow-settings-domain-decoupling`: explicit domain contracts for settings lifecycle (load -> edit -> save -> run-once merge).

### Modified Capabilities

- Existing workflow settings UI and execution context paths remain behavior-equivalent but consume domain APIs.

## Impact

- Affects:
  - `src/modules/workflowSettings.ts`
  - `src/modules/workflowSettingsDialog.ts`
  - settings-related execution wiring in workflow modules/tests
- No intended feature change or UX drift.
- Primary baseline traceability: `HB-04`.
