## ADDED Requirements

### Requirement: Debug-Only Diagnostic Workflow Visibility
The system SHALL allow builtin workflows to declare `debug_only: true` and SHALL hide those workflows from normal workflow menus and lists when hardcoded debug mode is disabled.

#### Scenario: Debug mode enabled
- **WHEN** hardcoded debug mode is enabled
- **THEN** `debug_only` workflows are visible in workflow menus and workflow lists

#### Scenario: Debug mode disabled
- **WHEN** hardcoded debug mode is disabled
- **THEN** `debug_only` workflows are hidden from workflow menus and workflow lists

### Requirement: Workflow Debug Probe
The system SHALL provide a debug-only builtin workflow that reuses the real workflow preflight chain and reports why loaded workflows are enabled or disabled for the current selection.

#### Scenario: Probe execution
- **WHEN** the debug probe workflow is triggered with a non-empty selection
- **THEN** it runs selection-context rebuild, execution-context resolution, provider resolution, and build-request preflight for visible non-debug workflows
- **AND** it opens a read-only diagnostic panel
- **AND** it writes the same structured result to runtime logs

### Requirement: Structured Hook Failure Logging
The system SHALL preserve structured hook failure diagnostics in normal execution logs.

#### Scenario: Hook failure
- **WHEN** `filterInputs`, `buildRequest`, or `applyResult` throws
- **THEN** logs retain `error.message`, `error.stack`, hook name, and package metadata
