## ADDED Requirements

### Requirement: Reference Workbench Package SHALL Provide Export-Notes Workflow For Literature-Digest Generated Notes
The `reference-workbench-package` MUST provide workflow `export-notes` to export literature-digest generated notes from selected parent items or selected generated notes.

#### Scenario: Parent selection expands generated notes
- **WHEN** the user triggers `export-notes` on one or more parent items
- **THEN** the workflow SHALL collect existing `digest`, `references`, and `citation-analysis` notes under each parent
- **AND** a parent with none of the three notes SHALL be treated as an invalid input unit

#### Scenario: Direct generated note selection is accepted
- **WHEN** the user selects one or more generated notes directly
- **THEN** only `digest`, `references`, and `citation-analysis` notes SHALL be accepted
- **AND** other note types SHALL be filtered out

#### Scenario: Mixed multi-selection exports in one trigger
- **WHEN** the user triggers `export-notes` with multiple parents, multiple notes, or a mixed selection
- **THEN** the workflow SHALL aggregate the export into one execution job
- **AND** it SHALL prompt for export destination only once

### Requirement: Export-Notes SHALL Materialize Canonical Artifact Files Per Parent Folder
The export workflow MUST write canonical literature-digest artifact files into per-parent folders.

#### Scenario: Export digest and references artifacts
- **WHEN** a selected parent has digest and references notes
- **THEN** the workflow SHALL create a subfolder named `Parent Title [itemKey]`
- **AND** digest content SHALL be exported to `digest.md`
- **AND** references payload SHALL be base64-decoded and exported as the native references artifact
- **AND** the default export shape SHALL be a bare JSON array

#### Scenario: Export citation analysis as json and markdown
- **WHEN** a selected parent has a citation-analysis note
- **THEN** the workflow SHALL export decoded payload to `citation_analysis.json`
- **AND** it SHALL export `citation_analysis.report_md` to `citation_analysis.md`

### Requirement: Reference Workbench Package SHALL Provide Import-Notes Workflow For Literature-Digest Artifacts
The `reference-workbench-package` MUST provide workflow `import-notes` to import literature-digest artifact files into exactly one selected parent item.

#### Scenario: Import accepts exactly one parent item
- **WHEN** the user triggers `import-notes`
- **THEN** the workflow SHALL accept exactly one selected parent item
- **AND** it SHALL reject no-selection, multi-parent, note-selection, and mixed-selection triggers

#### Scenario: Import dialog selects independent artifact types
- **WHEN** the import workflow opens
- **THEN** the dialog SHALL expose independent file-selection controls for `digest`, `references`, and `citation-analysis`
- **AND** it SHALL show whether each corresponding generated note already exists under the target parent

### Requirement: Import-Notes SHALL Validate Structured JSON Artifacts Before Candidate Acceptance
The import workflow MUST validate structured JSON artifacts before allowing them into the pending import candidate set.

#### Scenario: References import candidate uses copied local schema
- **WHEN** the user selects a references JSON file
- **THEN** the workflow SHALL validate it against the copied local `references.schema.json`
- **AND** only a valid candidate SHALL proceed to import

#### Scenario: Bare-array references artifact is accepted
- **WHEN** the user selects a bare-array references JSON file produced by Skill-Runner
- **THEN** the workflow SHALL accept it as a native references artifact
- **AND** it MAY wrap the array to `{ items: [...] }` internally for schema validation only

#### Scenario: Citation analysis import candidate uses copied local schema
- **WHEN** the user selects a citation-analysis JSON file
- **THEN** the workflow SHALL validate it against the copied local `citation_analysis.schema.json`
- **AND** only a valid candidate SHALL proceed to import

#### Scenario: Wrapper-shaped JSON is rejected
- **WHEN** the user selects a legacy wrapper-shaped references or citation-analysis JSON file
- **THEN** the workflow SHALL reject it during validation
- **AND** it SHALL NOT add that file to the pending import candidates

### Requirement: Import-Notes SHALL Confirm Conflicts Once Per Import Batch
If any selected artifact would overwrite an existing generated note, the workflow MUST use one conflict confirmation for the whole import batch.

#### Scenario: Overwrite all selected artifacts
- **WHEN** one or more selected artifact kinds already exist under the parent
- **AND** the user chooses `覆盖`
- **THEN** the workflow SHALL overwrite all selected candidates
- **AND** the workflow SHALL finish successfully

#### Scenario: Decline overwrite for the whole batch
- **WHEN** one or more selected artifact kinds already exist under the parent
- **AND** the user chooses `不覆盖`
- **THEN** the workflow SHALL abandon the whole import batch
- **AND** it SHALL finish without mutating any generated note

#### Scenario: Return from conflict prompt to import window
- **WHEN** one or more selected artifact kinds already exist under the parent
- **AND** the user chooses `取消`
- **THEN** the workflow SHALL close the conflict prompt
- **AND** it SHALL return to the import selection window with the current pending choices preserved
