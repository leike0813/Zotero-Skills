## ADDED Requirements

### Requirement: Workflow settings dialog SHALL render enum recommendations with editable input when allowCustom is enabled
For enum-backed string parameters with `allowCustom=true`, dialog rendering MUST provide both recommendation selection and free-text editing in one coherent control group.

#### Scenario: Selection from recommendation list
- **WHEN** user picks an option from the enum recommendation dropdown
- **THEN** dialog SHALL sync that value into the editable input
- **AND** serialized draft SHALL contain the selected value

#### Scenario: Manual custom value overrides recommendation
- **WHEN** user types a custom string into the editable input for the same field
- **THEN** dialog SHALL keep the custom value even if it is outside enum
- **AND** serialized draft SHALL use the editable input value as the final payload

#### Scenario: Strict enum fields keep existing select-only rendering
- **WHEN** parameter defines enum but `allowCustom` is missing or false
- **THEN** dialog SHALL keep existing dropdown-only behavior
- **AND** no editable companion input SHALL be rendered
