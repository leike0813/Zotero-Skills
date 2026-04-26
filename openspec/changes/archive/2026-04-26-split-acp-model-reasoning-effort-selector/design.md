## Design

This change implements a frontend compatibility layer only. The ACP adapter still receives and sends raw ACP `modelId` values through the existing `session/set_model` method.

## Model Derivation

The session manager derives a display model view after every model state update and after persisted snapshot hydration. Raw `modelOptions/currentModel` remain unchanged.

Recognized effort suffixes:

- `@default`, `@low`, `@medium`, `@high`, `@xhigh`
- `(default)`, `(low)`, `(medium)`, `(high)`, `(xhigh)`
- `- default`, `- low`, `- medium`, `- high`, `- xhigh`

Only groups with more than one recognized effort variant are folded into one display model plus multiple effort options. Single variants and unrecognized model names remain normal model options with no visible effort selector.

## Selection Mapping

The display model selector uses base model IDs. The reasoning selector uses effort IDs.

When the user changes the display model, the manager maps the selected base model plus current effort to the best raw ACP model ID. If the target model does not support the current effort, it falls back to `default` and then to the first available variant.

When the user changes reasoning effort, the manager maps the active display model plus selected effort to the matching raw ACP model ID and calls the existing adapter `setModel`.

## RFD Boundary

ACP Session Config Options RFD support is explicitly deferred. Future work may consume backend-advertised `thought_level` / `configOptions`, but this change does not add protocol methods or config-option state.
