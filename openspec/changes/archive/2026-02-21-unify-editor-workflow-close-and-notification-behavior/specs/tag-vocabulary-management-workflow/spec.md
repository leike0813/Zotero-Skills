## ADDED Requirements

### Requirement: Tag manager workflow SHALL suppress workflow execution reminders
The `tag-manager` workflow MUST disable workflow execution reminders (start toast, per-job toasts, end-of-run summary alert) and rely on editor save/discard semantics as the primary completion feedback.

#### Scenario: Save completes without execution reminders
- **WHEN** user saves tag vocabulary edits in the tag manager editor
- **THEN** workflow SHALL persist vocabulary changes
- **AND** workflow runtime SHALL NOT emit start/per-job toasts
- **AND** workflow runtime SHALL NOT show final succeeded/failed summary alert dialog

#### Scenario: Discard/cancel completes without execution reminders
- **WHEN** user closes tag manager editor without saving (clean close or discard on dirty close)
- **THEN** workflow SHALL keep persisted vocabulary unchanged
- **AND** workflow runtime SHALL NOT emit start/per-job toasts
- **AND** workflow runtime SHALL NOT show final succeeded/failed summary alert dialog

### Requirement: Tag manager editor title SHALL be selection-independent
The `tag-manager` editor title MUST be derived from workflow label only and MUST NOT append selected-item title.

#### Scenario: Triggered from any selected item
- **WHEN** user launches `tag-manager` from different selected parents/notes/attachments
- **THEN** editor window title SHALL remain a stable workflow-centric label
- **AND** title SHALL NOT include trigger selection name fragments
