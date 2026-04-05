## ADDED Requirements

### Requirement: Workflow package hooks SHALL support multi-file import selection through host API

Workflow package hooks MUST be able to request multi-file selection through
the core host API facade.

#### Scenario: package hook requests multiple import files

- **WHEN** a package workflow needs the user to select multiple import files in one interaction
- **THEN** it SHALL call `runtime.hostApi.file.pickFiles(...)`
- **AND** the host API SHALL return an ordered array of absolute file paths

#### Scenario: user cancels multi-file picker

- **WHEN** the user dismisses the multi-file picker without choosing files
- **THEN** `runtime.hostApi.file.pickFiles(...)` SHALL return `null`
- **AND** the workflow SHALL be able to abort import cleanly without partial selection
