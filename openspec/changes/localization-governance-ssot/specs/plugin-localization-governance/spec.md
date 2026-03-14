## ADDED Requirements

### Requirement: Locale key ownership SHALL be explicit by file
Localization keys SHALL follow file ownership rules to avoid drift and duplicated semantics.

#### Scenario: Runtime-facing key placement
- **WHEN** a runtime-facing message is added (toast, dashboard, backend display text)
- **THEN** the key SHALL be defined in `addon.ftl`

#### Scenario: Preferences-only key placement
- **WHEN** a preferences-pane-only label/message is added
- **THEN** the key SHALL be defined in `preferences.ftl`

#### Scenario: Main window/menu key placement
- **WHEN** a main-window/menu entry string is added
- **THEN** the key SHALL be defined in `mainWindow.ftl`

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

#### Scenario: Legacy managed backend id display
- **WHEN** display name resolution receives `skillrunner-local` or `local-skillrunner-backend`
- **THEN** both SHALL resolve through managed-local-backend localization path
- **THEN** resolved user-visible text SHALL not echo raw backend id

#### Scenario: Toast localization fallback
- **WHEN** runtime toast localization key is unresolved or unavailable
- **THEN** fallback text SHALL be selected by runtime locale (`zh`/default)
- **THEN** fixed-English-only fallback SHALL NOT be used

### Requirement: Localization governance SHALL be CI-gated
Localization governance checks SHALL run in CI gate flow before suite execution.

#### Scenario: Governance regression
- **WHEN** key parity, required keys, duplicate policy, or managed-backend localization wiring is violated
- **THEN** CI gate SHALL fail before running test suite command
