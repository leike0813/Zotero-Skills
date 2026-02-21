## MODIFIED Requirements

### Requirement: Workflow Editor Host SHALL Manage Dialog Lifecycle Uniformly
The system SHALL provide a generic workflow editor host that owns dialog open/close, save/discard/cancel resolution, dirty-close confirmation, and cleanup for local workflow editors.

#### Scenario: Save closes session with payload
- **WHEN** a renderer session is closed through Save
- **THEN** host SHALL resolve the current session as saved
- **AND** host SHALL return edited payload to caller
- **AND** host SHALL close and cleanup the dialog resources

#### Scenario: Close without save on clean state closes directly
- **WHEN** user cancels or closes the editor dialog without Save and no edits were made
- **THEN** host SHALL close immediately without save/discard confirmation prompt
- **AND** host SHALL resolve the current session as not-saved with explicit cancel reason

#### Scenario: Close without save on dirty state prompts save, discard, or cancel
- **WHEN** user cancels or closes the editor dialog without Save after edits were made
- **THEN** host SHALL ask whether to save changes before closing
- **AND** choosing Save SHALL resolve as saved with serialized payload
- **AND** choosing Discard SHALL resolve as not-saved and close without payload write
- **AND** choosing Cancel SHALL keep the editor dialog open and keep current edits intact
