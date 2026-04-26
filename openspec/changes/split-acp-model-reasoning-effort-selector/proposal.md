## Why

ACP backends may expose reasoning effort as multiple variants of the same model, such as `gpt-5@low`, `gpt-5@medium`, and `gpt-5@high`. Showing each variant as a separate model clutters the composer and makes model selection harder than necessary.

This change keeps the current ACP wire protocol intact while presenting model and reasoning effort as separate frontend controls.

## What Changes

- Derive display model choices and reasoning effort choices from the raw ACP `modelOptions/currentModel` state.
- Keep raw ACP model IDs as the source of truth and map frontend model/effort selections back to the real `modelId` before calling `session/set_model`.
- Add a `Reasoning` selector to the ACP chat composer footer when the active model has multiple recognized effort variants.
- Preserve existing ACP behavior for backends that do not expose effort variants.
- Do not implement ACP RFD `configOptions` or `session/set_config_option` in this change.

## Capabilities

### New Capabilities

- `acp-model-effort-selector`: ACP chat separates model selection from reasoning effort when model variants encode effort in their IDs or labels.

### Modified Capabilities

- None.

## Impact

- ACP session snapshot/view-model gains frontend-derived display model and reasoning effort fields.
- ACP sidebar bridge gains a `set-reasoning-effort` action.
- ACP chat UI gains a conditional `Reasoning` selector.
- Tests cover derivation, mapping, persistence restore, and UI action routing.
