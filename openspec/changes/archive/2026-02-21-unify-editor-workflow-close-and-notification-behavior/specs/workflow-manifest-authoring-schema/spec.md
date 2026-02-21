## ADDED Requirements

### Requirement: Workflow manifest schema SHALL support per-workflow execution reminder control
The standalone workflow manifest schema MUST allow workflows to declare whether workflow execution reminders are shown via `execution.feedback.showNotifications`.

#### Scenario: Author enables reminder suppression declaratively
- **WHEN** a workflow manifest declares `"execution": { "feedback": { "showNotifications": false } }`
- **THEN** schema validation SHALL accept the manifest as valid
- **AND** runtime loader validation SHALL not emit a `manifest_validation_error` for this field

#### Scenario: Invalid reminder switch type is rejected
- **WHEN** a workflow manifest declares `execution.feedback.showNotifications` as a non-boolean value
- **THEN** schema validation SHALL reject the manifest
- **AND** workflow loader SHALL surface deterministic manifest validation diagnostics
