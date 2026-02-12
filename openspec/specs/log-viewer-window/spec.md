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
The log viewer MUST provide user actions to copy logs for issue reporting and agent debugging.

#### Scenario: Copy visible logs
- **WHEN** user triggers copy action for visible logs
- **THEN** the output SHALL be generated from currently filtered entries
- **AND** the default copy format SHALL be Pretty JSON Array

#### Scenario: Copy all logs
- **WHEN** user triggers copy all action
- **THEN** the output SHALL include all retained entries in Pretty JSON Array format

### Requirement: Log Viewer Window SHALL Include Internationalized Labels
The log window MUST use locale strings for labels, actions, and status messages.

#### Scenario: Locale-specific action labels
- **WHEN** plugin language is switched between supported locales
- **THEN** log window action labels SHALL display translated text instead of hardcoded English strings

