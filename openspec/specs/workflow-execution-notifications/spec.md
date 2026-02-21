# workflow-execution-notifications Specification

## Purpose
TBD - created by archiving change enhance-workflow-notifications-i18n-toasts. Update Purpose after archive.
## Requirements
### Requirement: Workflow Execution Summary Dialog SHALL Support Localization
Workflow execution reminders (start toast, per-job toasts, final summary dialog) SHALL be localizable and SHALL be shown only when the workflow execution feedback config enables reminders.

#### Scenario: Localized reminders on execution when enabled
- **WHEN** a workflow trigger runs and `execution.feedback.showNotifications` is omitted or `true`
- **THEN** runtime SHALL emit localized start and per-job toasts
- **AND** final summary dialog SHALL use locale-specific text
- **AND** final summary dialog SHALL include succeeded/failed counts
- **AND** final summary dialog SHALL include skipped count when skipped units exist

#### Scenario: Execution reminders are suppressed when disabled
- **WHEN** a workflow trigger runs and `execution.feedback.showNotifications` is `false`
- **THEN** runtime SHALL NOT emit start toast
- **AND** runtime SHALL NOT emit per-job toasts
- **AND** runtime SHALL NOT open the final summary alert dialog
- **AND** workflow execution result logging SHALL remain available

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

