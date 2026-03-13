# log-viewer-window Specification

## Purpose
TBD - created by archiving change add-plugin-log-system. Update Purpose after archive.
## Requirements
### Requirement: Log Viewer Window SHALL Be Openable from Plugin Workflow Menu
The plugin SHALL provide a dedicated log window entry from workflow-related menu actions.

#### Scenario: Open log window from menu
- **WHEN** user clicks the log menu entry in plugin workflow menu
- **THEN** the plugin SHALL open an independent log window

### Requirement: Log Viewer Window SHALL Default to Showing All Levels and Provide Level Filters
The log viewer SHALL show all available levels in its visible filter state by default and SHALL allow users to filter by level.

#### Scenario: Initial open state
- **WHEN** the log window opens
- **THEN** visible filters SHALL include all levels (`debug/info/warn/error`) selected by default

#### Scenario: Filter to errors only
- **WHEN** user applies level filter to `error` only
- **THEN** the log list SHALL only display entries whose level is `error`

### Requirement: Log Viewer Window SHALL Support Copy/Export for Debug Feedback
The log viewer MUST provide user actions to copy diagnostics for issue reporting and agent debugging, including structured bundle export.

#### Scenario: Copy visible logs
- **WHEN** user triggers copy action for visible logs
- **THEN** the output SHALL be generated from currently filtered entries
- **AND** the default copy format SHALL be Pretty JSON Array

#### Scenario: Copy all logs
- **WHEN** user triggers copy all action
- **THEN** the output SHALL include all retained entries in Pretty JSON Array format

#### Scenario: Copy diagnostic bundle JSON
- **WHEN** user triggers `Copy Diagnostic Bundle JSON`
- **THEN** the output SHALL conform to `RuntimeDiagnosticBundleV1`
- **AND** output SHALL respect current filters and selected time scope

#### Scenario: Copy issue summary markdown
- **WHEN** user triggers `Copy Issue Summary`
- **THEN** the output SHALL include environment summary, repro window, top errors, and correlated request/job identifiers

### Requirement: Log Viewer Window SHALL Include Internationalized Labels
The log window MUST use locale strings for labels, actions, and status messages, including newly added diagnostic controls.

#### Scenario: Locale-specific action labels
- **WHEN** plugin language is switched between supported locales
- **THEN** log window action labels SHALL display translated text instead of hardcoded English strings

### Requirement: Log Viewer Window SHALL Expose Diagnostic Mode Toggle
The log viewer MUST expose a session-level diagnostic mode toggle and reflect its current state.

#### Scenario: Enable diagnostic mode from viewer
- **WHEN** user turns on diagnostic mode in log viewer
- **THEN** runtime log pipeline SHALL switch to diagnostic collection mode for current session
- **AND** viewer SHALL show an active diagnostic-state indicator

### Requirement: Log Viewer Window SHALL Show Budget and Sanitization Status
The log viewer MUST surface retention budget and sanitization metadata to explain dropped data and redaction behavior.

#### Scenario: Budget limit reached
- **WHEN** retention budget evicts entries or payload bytes
- **THEN** viewer SHALL display eviction notice with reason (`entry_limit` or `byte_budget`)

#### Scenario: Sanitization policy reminder
- **WHEN** logs are displayed or exported
- **THEN** viewer SHALL show that sensitive values are redacted and large payloads are summarized

