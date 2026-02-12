# reference-note-editor-workflow Specification

## Purpose
TBD - created by archiving change add-reference-note-editor-workflow. Update Purpose after archive.
## Requirements
### Requirement: Reference Note Editor Workflow SHALL Use Pass-Through Local Execution
The workflow MUST execute through `pass-through` provider and MUST NOT depend on remote backend calls.

#### Scenario: Trigger workflow execution
- **WHEN** user triggers the reference-note editor workflow
- **THEN** execution SHALL run locally via pass-through provider
- **AND** no external backend request SHALL be required

### Requirement: Workflow SHALL Accept the Same Legal Input Shapes as Reference-Matching
The workflow MUST accept references notes selected directly and references notes resolved from selected parent items.

#### Scenario: Direct references note selection
- **WHEN** user selects one or more valid references notes
- **THEN** each valid references note SHALL become an input unit

#### Scenario: Parent selection expansion
- **WHEN** user selects parent items that contain valid references notes
- **THEN** workflow SHALL resolve those references notes as input units

#### Scenario: No valid references note
- **WHEN** selection contains no valid references note after filtering
- **THEN** workflow SHALL be treated as non-executable for this trigger

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

### Requirement: Save SHALL Rewrite Payload and Rendered Table in Canonical Structure
On save, the workflow MUST regenerate payload and table and write both back to the same note.

#### Scenario: Save editor result
- **WHEN** user clicks Save in editor
- **THEN** workflow SHALL regenerate `references-json` payload
- **AND** workflow SHALL regenerate `data-zs-view="references-table"` HTML
- **AND** note content SHALL preserve canonical references note structure

### Requirement: Cancel or Close Without Save SHALL Fail Current Job
If user closes editor without saving, the current input unit MUST be marked failed and note MUST remain unchanged.

#### Scenario: Cancel current editor
- **WHEN** user clicks Cancel or closes the editor window without Save
- **THEN** current job SHALL fail with an explicit cancel reason
- **AND** no note rewrite SHALL happen for that job

### Requirement: Multi-Input Trigger SHALL Open Editor Windows Sequentially with Clear Parent Context
For multiple valid inputs in a single trigger, workflow execution MUST open editor sessions sequentially via host and each editor session MUST identify parent context.

#### Scenario: Multiple valid references notes in one trigger
- **WHEN** workflow trigger resolves more than one valid input unit
- **THEN** editor sessions SHALL open sequentially through host (not in parallel)
- **AND** each session SHALL clearly indicate which parent item or note context is being edited

