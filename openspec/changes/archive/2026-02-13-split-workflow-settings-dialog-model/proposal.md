## Why

`HB-05` requires splitting workflow settings dialog rendering from data/model assembly.
After `HB-04` (`decouple-workflow-settings-domain`), domain contracts are clearer, but `workflowSettingsDialog.ts` still mixes:

- render-model composition,
- schema-driven field wiring,
- UI event wiring,
- draft collection and save/apply payload shaping.

This keeps the dialog module large and harder to test in isolation.

## What Changes

- Introduce an explicit dialog render-model layer for workflow settings UI.
- Move schema-driven section/field composition out of view host code into pure model builders.
- Keep dialog rendering focused on displaying model + forwarding user intent.
- Centralize draft-to-domain payload shaping so dialog does not duplicate normalization assumptions.
- Preserve behavior parity:
  - run-once default reset-on-open,
  - save/apply semantics,
  - current localized copy and interaction flow.

## Capabilities

### New Capabilities

- `workflow-settings-dialog-model-split`: enforces a render-model boundary between settings domain and dialog UI host.

### Modified Capabilities

- Existing workflow settings dialog behavior remains unchanged while internal responsibilities are split for readability/testability.

## Impact

- Expected touched files:
  - `src/modules/workflowSettingsDialog.ts`
  - new dialog model/helper module(s) under `src/modules/`
  - tests around workflow settings dialog/domain integration
- No intended user-visible behavior change.
- Primary baseline traceability: `HB-05`.
