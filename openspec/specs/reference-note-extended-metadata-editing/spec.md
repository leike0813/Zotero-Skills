# reference-note-extended-metadata-editing Specification

## Purpose
TBD - created by archiving change enhance-reference-note-editor-metadata-and-table-columns. Update Purpose after archive.
## Requirements
### Requirement: Reference Note Editor MUST Expose Extended Optional Metadata Fields
The Reference Note Editor SHALL render editable inputs for the following optional fields on each reference row: `publicationTitle`, `conferenceName`, `university`, `archiveID`, `volume`, `issue`, `pages`, and `place`.

#### Scenario: Open editor with existing extended metadata
- **WHEN** user opens Reference Note Editor for a references note whose payload rows already contain any extended optional metadata fields
- **THEN** editor SHALL display the corresponding values in the mapped field inputs
- **AND** missing optional fields SHALL be shown as empty editable inputs

### Requirement: Reference Note Editor MUST Persist Extended Metadata on Save
When user saves the editor, extended optional metadata edits SHALL be written back into `references-json` payload rows without dropping existing supported fields.

#### Scenario: Edit and save extended metadata
- **WHEN** user edits one or more extended optional metadata fields and clicks Save
- **THEN** workflow SHALL write updated values to the corresponding payload row fields
- **AND** existing core fields (`title`, `author`, `year`, `citekey`, `rawText` when present) SHALL remain preserved unless explicitly edited

### Requirement: Reference Note Editor MUST Preserve Extended Metadata Through Row Operations
Add, delete, and reorder operations in the editor SHALL preserve extended optional metadata consistency for remaining rows.

#### Scenario: Reorder rows containing extended metadata
- **WHEN** user reorders rows that contain extended optional metadata values and saves
- **THEN** payload row order SHALL match edited order
- **AND** each row’s extended optional metadata values SHALL stay attached to the same logical row content after reordering

