## ADDED Requirements

### Requirement: Tag manager workflow SHALL provide protocol-aligned CRUD operations
`tag-manager` workflow MUST implement controlled vocabulary CRUD semantics aligned with `reference/Zotero_TagVocab/protocol/operations/*`.

#### Scenario: Create tag with protocol validation
- **WHEN** user creates a new tag entry in the panel
- **THEN** system SHALL validate facet/format/duplicate/abbrev-case constraints before persistence
- **AND** invalid requests SHALL return deterministic validation errors

#### Scenario: Update and rename tag entry
- **WHEN** user edits note/source/deprecated or renames tag value
- **THEN** system SHALL update exactly one existing entry
- **AND** rename collision checks SHALL follow protocol duplicate rules

#### Scenario: Delete supports soft and hard modes
- **WHEN** user chooses delete action
- **THEN** system SHALL support soft-delete (`deprecated=true`) and hard-delete (remove entry)
- **AND** behavior SHALL be explicit in operation result

### Requirement: Controlled vocabulary state SHALL be persisted across sessions
The managed vocabulary MUST be persisted locally and reloaded deterministically.

#### Scenario: Save and reopen
- **WHEN** user saves changes and reopens the manager workflow later
- **THEN** the latest committed vocabulary state SHALL be restored

#### Scenario: Corrupted persisted payload
- **WHEN** persisted vocabulary payload is invalid or unreadable
- **THEN** system SHALL fail safely with deterministic fallback
- **AND** SHALL NOT write partially invalid state back as valid data

### Requirement: Workflow SHALL export controlled tags as plain string arrays
The manager workflow MUST export current controlled tags as `facet:value` string arrays for downstream `tag-regulator` consumption.

#### Scenario: Export strips metadata
- **WHEN** export is triggered
- **THEN** output SHALL contain tag strings only
- **AND** SHALL NOT include note/source/deprecated metadata fields

#### Scenario: Export order is deterministic
- **WHEN** vocabulary content is unchanged across runs
- **THEN** exported array order SHALL remain stable

### Requirement: Workflow SHALL import controlled vocabulary from protocol-aligned YAML sources
The manager workflow MUST support importing from `tags/tags.yaml`-style full-field YAML sources and apply conflict strategies consistent with `import_tags`.

#### Scenario: Import full-field YAML succeeds
- **WHEN** user selects a valid YAML file containing entries with `tag/facet/source/note/deprecated`
- **THEN** workflow SHALL validate each entry and merge into persisted vocabulary
- **AND** imported state SHALL remain deterministic by facet then tag

#### Scenario: Duplicate handling follows on_duplicate strategy
- **WHEN** imported entries collide with existing tags
- **THEN** `skip` SHALL keep existing entries, `overwrite` SHALL replace existing entries
- **AND** `error` SHALL abort import on first duplicate without mutating persisted state

#### Scenario: Dry-run import is non-destructive
- **WHEN** user enables `dry_run`
- **THEN** workflow SHALL report imported/skipped/overwritten/errors
- **AND** SHALL NOT mutate persisted vocabulary state

### Requirement: Validation and compile semantics SHALL remain deterministic
The workflow domain layer MUST provide deterministic validate/compile style behaviors consistent with protocol intent.

#### Scenario: Validate catches cross-entry issues
- **WHEN** vocabulary contains duplicate/case-duplicate/facet-mismatch issues
- **THEN** validation SHALL report deterministic issue set with stable codes

#### Scenario: Compile emits stable merged ordering
- **WHEN** per-facet entries are merged for export view
- **THEN** merged ordering SHALL be deterministic by facet then tag
