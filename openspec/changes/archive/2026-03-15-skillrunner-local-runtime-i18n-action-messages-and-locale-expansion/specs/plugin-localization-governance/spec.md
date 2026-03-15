## MODIFIED Requirements

### Requirement: Localization governance SHALL be CI-gated
Localization governance checks SHALL run in CI gate flow before suite execution.

#### Scenario: Governance regression
- **WHEN** key parity, required keys, duplicate policy, or managed-backend localization wiring is violated
- **THEN** CI gate SHALL fail before running test suite command

#### Scenario: Four-locale hard gate
- **WHEN** governance validator runs
- **THEN** it SHALL validate `en-US`, `zh-CN`, `ja-JP`, and `fr-FR`
- **AND** each locale SHALL have key parity for `addon.ftl` and `preferences.ftl` against `en-US`

### Requirement: Managed local backend localization SHALL use centralized fallback
Managed local backend display name and runtime toast text SHALL use a centralized fallback helper and SHALL not use module-local fixed-language fallback strings.

#### Scenario: Local runtime action/result keys are governed
- **WHEN** new local-runtime action working or user-visible result keys are added
- **THEN** they SHALL be included in governance required-key checks
- **AND** missing keys in any governed locale SHALL fail validation
