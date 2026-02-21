## ADDED Requirements

### Requirement: Workflow parameter schema SHALL support optional allowCustom for enum-backed string parameters
Workflow manifest authoring schema MUST allow parameter authors to declare whether `enum` values are strict constraints or recommended options.

#### Scenario: Author declares enum with allowCustom enabled
- **WHEN** a workflow parameter defines `type: "string"`, an `enum` list, and `allowCustom: true`
- **THEN** manifest schema validation SHALL accept the declaration
- **AND** runtime contract SHALL treat enum as recommended values for that parameter

#### Scenario: Author omits allowCustom
- **WHEN** a workflow parameter defines `enum` but does not define `allowCustom`
- **THEN** manifest schema validation SHALL accept the declaration
- **AND** runtime behavior SHALL default to strict-enum semantics

#### Scenario: Author provides invalid allowCustom type
- **WHEN** a workflow parameter sets `allowCustom` to a non-boolean value
- **THEN** manifest schema validation SHALL reject the manifest with deterministic diagnostics
