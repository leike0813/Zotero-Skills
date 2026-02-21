## MODIFIED Requirements

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
