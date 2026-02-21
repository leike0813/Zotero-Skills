## ADDED Requirements

### Requirement: Workflow parameter normalization SHALL support enum-as-recommendation when allowCustom is enabled
Workflow settings domain normalization MUST preserve custom string inputs for enum-backed parameters when the manifest explicitly enables `allowCustom`.

#### Scenario: Custom string survives enum normalization with allowCustom=true
- **WHEN** workflow parameter schema is `type=string`, `enum=[...]`, and `allowCustom=true`
- **AND** user-provided value is a non-empty string outside enum
- **THEN** normalized workflow params SHALL keep the provided value
- **AND** value SHALL still pass string-type normalization path

#### Scenario: Strict enum remains default
- **WHEN** workflow parameter schema is `type=string`, `enum=[...]`, and `allowCustom` is missing or false
- **AND** user-provided value is outside enum
- **THEN** normalization SHALL reject the out-of-enum value
- **AND** fallback behavior SHALL remain unchanged (default value or omission)
