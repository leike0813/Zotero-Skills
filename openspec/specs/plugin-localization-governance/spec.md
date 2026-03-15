# plugin-localization-governance Specification

## Purpose
Define localization SSOT for ownership, fallback, and CI governance so user-visible copy remains consistent across all supported locales.
## Requirements
### Requirement: Locale key ownership SHALL be explicit by file
Localization keys SHALL follow file ownership rules to avoid drift and duplicated semantics.

#### Scenario: Runtime-facing key placement
- **WHEN** a runtime-facing message is added (toast, dashboard, backend display text)
- **THEN** the key SHALL be defined in `addon.ftl`

#### Scenario: Preferences-only key placement
- **WHEN** a preferences-pane-only label/message is added
- **THEN** the key SHALL be defined in `preferences.ftl`

### Requirement: Cross-file duplicate keys SHALL be controlled
Duplicate localization keys across FTL files are forbidden by default and SHALL only exist through explicit compatibility allowlist.

#### Scenario: Duplicate key outside allowlist
- **WHEN** a key appears in multiple FTL files and is not allowlisted
- **THEN** governance validation SHALL fail

#### Scenario: Compatibility alias key
- **WHEN** a duplicate key is intentionally retained for migration compatibility
- **THEN** it SHALL be declared in an explicit allowlist and tracked for cleanup

### Requirement: Managed local backend localization SHALL use centralized fallback
Managed local backend display name and runtime toast text SHALL use a centralized fallback helper and SHALL not use module-local fixed-language fallback strings.

#### Scenario: Local runtime action/result keys are governed
- **WHEN** new local-runtime action working or user-visible result keys are added
- **THEN** they SHALL be included in governance required-key checks
- **AND** missing keys in any governed locale SHALL fail validation

### Requirement: Localization governance SHALL be CI-gated
Localization governance checks SHALL run in CI gate flow before suite execution.

#### Scenario: Governance regression
- **WHEN** key parity, required keys, duplicate policy, or managed-backend localization wiring is violated
- **THEN** CI gate SHALL fail before running test suite command

#### Scenario: Four-locale hard gate
- **WHEN** governance validator runs
- **THEN** it SHALL validate `en-US`, `zh-CN`, `ja-JP`, and `fr-FR`
- **AND** each locale SHALL have key parity for `addon.ftl` and `preferences.ftl` against `en-US`

### Requirement: Local runtime action/result copy SHALL be governed
Local runtime action-in-progress and user-visible stage-result messages SHALL be treated as required governed keys.

#### Scenario: Local runtime status mapping keys
- **WHEN** local runtime preferences status renderer depends on action-specific working keys or stage-result keys
- **THEN** those keys SHALL exist in all governed locales
- **AND** missing keys SHALL fail governance validation

