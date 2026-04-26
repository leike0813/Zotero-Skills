# acp-model-effort-selector Specification

## Purpose

ACP chat SHALL present model and reasoning effort as separate frontend controls when an ACP backend encodes effort as model variants.

## Requirements

### Requirement: Model variants SHALL be folded into display model and effort selectors

When raw ACP model options contain multiple recognized effort variants for the same base model, the ACP chat frontend SHALL show one display model option and a separate reasoning effort selector.

#### Scenario: Recognized suffix variants are folded

- **GIVEN** raw models `gpt-5@low`, `gpt-5@medium`, and `gpt-5@high`
- **WHEN** the ACP snapshot is projected for the sidebar
- **THEN** the display model selector SHALL contain `gpt-5` once
- **AND** the reasoning selector SHALL contain `low`, `medium`, and `high`

#### Scenario: Plain models remain unchanged

- **GIVEN** raw models without multiple recognized effort variants
- **WHEN** the ACP snapshot is projected for the sidebar
- **THEN** the display model selector SHALL show the raw models
- **AND** the reasoning selector SHALL be hidden or unavailable

### Requirement: Frontend selections SHALL map back to raw ACP model IDs

Changing display model or reasoning effort SHALL call existing ACP `session/set_model` with the matching raw `modelId`.

#### Scenario: Changing effort maps to variant model ID

- **GIVEN** the current raw model is `gpt-5@high`
- **WHEN** the user selects reasoning effort `medium`
- **THEN** the ACP adapter SHALL receive `setModel` with `modelId="gpt-5@medium"`

#### Scenario: Changing model preserves effort when possible

- **GIVEN** the current effort is `high`
- **WHEN** the user selects a display model that supports `high`
- **THEN** the ACP adapter SHALL receive that model's `high` variant
- **WHEN** the selected display model does not support `high`
- **THEN** the ACP adapter SHALL fall back to `default` or the first available variant

### Requirement: The ACP protocol surface SHALL remain unchanged

This feature SHALL NOT require ACP `configOptions`, `thought_level`, or `session/set_config_option`.

#### Scenario: Existing model control remains the wire-level mechanism

- **WHEN** the user changes model or reasoning effort
- **THEN** the frontend SHALL use the existing `session/set_model` adapter path
