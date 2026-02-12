# workflow-execution-notifications Specification

## Purpose
TBD - created by archiving change enhance-workflow-notifications-i18n-toasts. Update Purpose after archive.
## Requirements
### Requirement: Workflow Execution Summary Dialog SHALL Support Localization
The end-of-run summary dialog SHALL be localizable and include succeeded/failed/skipped counts.

#### Scenario: Localized summary dialog on completion
- **WHEN** a workflow trigger finishes
- **THEN** the summary dialog SHALL use locale-specific text
- **AND** it SHALL include succeeded/failed counts
- **AND** it SHALL include skipped count when skipped units exist

### Requirement: Workflow Trigger SHALL Emit Start Toast
The system SHALL show one transient toast when a workflow trigger starts execution.

#### Scenario: Trigger start toast
- **WHEN** execution requests are resolved and trigger starts running
- **THEN** exactly one start toast SHALL be shown for this trigger

### Requirement: Each Job Completion SHALL Emit Per-Job Toast
The system SHALL show one transient toast per job completion with success or failure status.

#### Scenario: Job success toast
- **WHEN** a job finishes successfully
- **THEN** one success toast SHALL be shown for that job

#### Scenario: Job failure toast
- **WHEN** a job finishes with failure (provider/applyResult/record issues)
- **THEN** one failure toast SHALL be shown for that job

### Requirement: Template Example Reminder Registration SHALL Be Removed
Template example reminder behaviors SHALL NOT be registered during plugin startup.

#### Scenario: No example shortcut reminder on startup
- **WHEN** plugin starts and initializes runtime hooks
- **THEN** template example shortcut reminder (e.g. "Example Shortcuts") SHALL NOT be shown
- **AND** core workflow menu/execution capabilities SHALL remain available

