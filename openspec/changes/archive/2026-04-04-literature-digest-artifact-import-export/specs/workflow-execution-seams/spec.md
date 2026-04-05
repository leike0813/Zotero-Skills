## ADDED Requirements

### Requirement: Workflow Package Hooks SHALL Be Able To Request File And Directory Selection Through Host API
Workflow package hooks MUST access user-driven file system pickers through the core host API facade rather than direct toolkit globals.

#### Scenario: Package hook picks export directory
- **WHEN** a package workflow needs the user to choose an export destination
- **THEN** it SHALL request the destination through `runtime.hostApi.file.pickDirectory(...)`
- **AND** a user cancel SHALL return `null`

#### Scenario: Package hook picks import file
- **WHEN** a package workflow needs the user to choose an import file
- **THEN** it SHALL request the file through `runtime.hostApi.file.pickFile(...)`
- **AND** the hook MAY provide title, starting directory, and file filters

### Requirement: Workflow Runtime Context SHALL Expose Workflow Asset Roots To Package Hooks
Package hooks that read packaged assets MUST receive the workflow and package root directories through runtime context.

#### Scenario: Import workflow loads copied schema assets
- **WHEN** a package workflow needs to read local schema assets bundled under its workflow directory
- **THEN** runtime context SHALL expose `workflowRootDir`
- **AND** the hook SHALL be able to resolve workflow-local asset paths through the host file API
