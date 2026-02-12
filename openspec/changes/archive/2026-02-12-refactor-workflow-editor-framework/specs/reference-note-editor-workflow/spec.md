## MODIFIED Requirements

### Requirement: Editor Window SHALL Support Full Entry Editing, Add/Delete, and Reorder
The workflow MUST invoke a generic workflow editor host with a reference-note renderer, and the editor UI MUST support full entry editing with structural operations.

#### Scenario: Host-based editor invocation
- **WHEN** reference-note-editor workflow runs on a valid input
- **THEN** workflow SHALL open editor through workflow editor host
- **AND** reference renderer SHALL be selected by renderer id

#### Scenario: Edit existing entry fields
- **WHEN** user changes title/year/author/citekey/raw text fields
- **THEN** saved payload SHALL contain updated values

#### Scenario: Add and delete entries
- **WHEN** user adds new rows or deletes existing rows
- **THEN** saved payload SHALL reflect the updated row set

#### Scenario: Reorder entries
- **WHEN** user reorders rows in the editor
- **THEN** saved payload order and rendered table order SHALL match the edited order

### Requirement: Multi-Input Trigger SHALL Open Editor Windows Sequentially with Clear Parent Context
For multiple valid inputs in a single trigger, workflow execution MUST open editor sessions sequentially via host and each editor session MUST identify parent context.

#### Scenario: Multiple valid references notes in one trigger
- **WHEN** workflow trigger resolves more than one valid input unit
- **THEN** editor sessions SHALL open sequentially through host (not in parallel)
- **AND** each session SHALL clearly indicate which parent item or note context is being edited

