## ADDED Requirements

### Requirement: Reference note editor workflow SHALL suppress workflow execution reminders
The `reference-note-editor` workflow MUST disable workflow execution reminders (start toast, per-job toasts, end-of-run summary alert) and treat save/discard outcomes as editor-session semantics.

#### Scenario: Save closes editor and updates note without execution reminders
- **WHEN** user edits references note and confirms Save
- **THEN** workflow SHALL persist rewritten payload/table content
- **AND** workflow runtime SHALL NOT emit start/per-job toasts
- **AND** workflow runtime SHALL NOT show final succeeded/failed summary alert dialog

#### Scenario: Dirty close with discard keeps note unchanged without execution reminders
- **WHEN** user edits references note and closes without Save, then chooses Discard
- **THEN** workflow SHALL keep note content unchanged
- **AND** workflow runtime SHALL NOT emit start/per-job toasts
- **AND** workflow runtime SHALL NOT show final succeeded/failed summary alert dialog

### Requirement: Reference note editor workflow SHALL honor host dirty-close confirmation
The workflow MUST rely on workflow editor host dirty-close confirmation behavior before deciding save vs discard outcome.

#### Scenario: Dirty close with Save writes edits
- **WHEN** user closes a dirty editor session and chooses Save in confirmation
- **THEN** workflow SHALL process session as saved
- **AND** note content update path SHALL execute as if Save button was clicked directly
