# tag-regulator-workflow Specification

## Purpose
TBD - created by archiving change add-tag-regulator-workflow. Update Purpose after archive.
## Requirements
### Requirement: Tag regulator capability SHALL be delivered as a decoupled workflow package
The `tag-regulator` capability MUST be implemented as a newly added workflow package and MUST remain decoupled from plugin source business branches.

#### Scenario: Implementation boundary for plugin source and workflow package
- **WHEN** this capability is implemented
- **THEN** `tag-regulator` business behavior SHALL reside in workflow manifest/hooks under `workflows/tag-regulator/**`
- **AND** plugin `src/**` SHALL only use existing generic workflow infrastructure without introducing `tag-regulator`-specific business branches

### Requirement: Tag regulator workflow SHALL process parent items as normalization units
`tag-regulator` workflow MUST treat each selected parent item as one independent normalization unit.

#### Scenario: Parent selection triggers one request per parent
- **WHEN** user selects one or more parent items and triggers `tag-regulator`
- **THEN** system SHALL build one normalization request per parent item
- **AND** each request/apply path SHALL be isolated from other parents

### Requirement: Workflow SHALL construct mixed-input payload for tag-regulator skill
The workflow MUST send `metadata`/`input_tags` as inline input and `valid_tags` as uploaded file input according to skill contract.

#### Scenario: Build request includes required fields
- **WHEN** workflow builds a skillrunner request for a parent item
- **THEN** payload SHALL include `input.metadata`, `input.input_tags`, and upload file key `valid_tags`
- **AND** payload parameter SHALL include runtime options like `infer_tag` and `valid_tags_format`

#### Scenario: Missing controlled vocabulary export fails safely
- **WHEN** workflow cannot resolve or materialize `valid_tags` input
- **THEN** that unit SHALL fail with deterministic diagnostics
- **AND** SHALL NOT mutate parent tags

### Requirement: Workflow SHALL apply tag-regulator result conservatively
The workflow MUST apply `remove_tags` and `add_tags` only when output is valid and non-error.

#### Scenario: Successful normalization result
- **WHEN** skill returns valid output with `error = null`
- **THEN** workflow SHALL remove tags listed in `remove_tags` and add tags listed in `add_tags`
- **AND** parent tags not listed in mutations SHALL remain unchanged

#### Scenario: Skill reports error or malformed payload
- **WHEN** skill returns `error != null` or output schema check fails
- **THEN** workflow SHALL skip tag mutation for that parent
- **AND** SHALL emit warnings/diagnostics for user review

### Requirement: Suggested tags SHALL remain advisory outputs
Tags in `suggest_tags` MUST NOT be written directly to parent items, and SHALL support user-confirmed intake into controlled vocabulary.

#### Scenario: No suggest_tags skips intake dialog
- **WHEN** skill output has empty or missing `suggest_tags`
- **THEN** workflow SHALL NOT open suggest-tag intake dialog
- **AND** workflow SHALL NOT modify controlled vocabulary via this branch

#### Scenario: Non-empty suggest_tags objects open confirm dialog
- **WHEN** skill output contains non-empty `suggest_tags` object array with `{tag,note}`
- **THEN** workflow SHALL open a dialog listing suggested tag rows
- **AND** each row SHALL display both `tag` and `note`
- **AND** user SHALL be able to select entries individually before submission

#### Scenario: Confirmed subset is added through tag-manager vocabulary interface
- **WHEN** user clicks `加入受控词表` with one or more selected suggested tags
- **THEN** workflow SHALL call tag-manager vocabulary persistence interface to add only selected entries
- **AND** each newly added entry SHALL set `source = agent-suggest`
- **AND** each newly added entry SHALL persist the selected `note`

#### Scenario: Canceling suggest-tags intake keeps vocabulary unchanged
- **WHEN** user closes or cancels the suggest-tags intake dialog
- **THEN** workflow SHALL NOT call vocabulary persistence
- **AND** controlled vocabulary content SHALL remain unchanged by this branch

#### Scenario: Intake path remains idempotent
- **WHEN** selected suggested tags already exist in controlled vocabulary
- **THEN** workflow SHALL skip duplicates without creating additional entries
- **AND** workflow SHALL report deterministic `added/skipped/invalid` summary

#### Scenario: Parent item tags are not auto-mutated by suggest_tags
- **WHEN** workflow processes `suggest_tags`
- **THEN** workflow SHALL NOT append these tags directly to parent item tags
- **AND** parent mutation SHALL remain limited to `remove_tags/add_tags` semantics

### Requirement: Tag regulator workflow SHALL expose tag_note_language parameter
`tag-regulator` workflow MUST declare and pass through `tag_note_language` for backend note-language control.

#### Scenario: Build request includes tag_note_language
- **WHEN** workflow executes with user-configured `tag_note_language`
- **THEN** request parameter SHALL include `tag_note_language` with the configured value
- **AND** default value SHALL be `zh-CN` when not overridden

### Requirement: Language option declaration SHALL align with literature-digest workflow
`tag-regulator.tag_note_language` and `literature-digest.language` MUST use the same declared option set and default.

#### Scenario: Both workflows expose same language options
- **WHEN** manifests are loaded
- **THEN** the language options declared by `tag-regulator` and `literature-digest` SHALL be equivalent
- **AND** both defaults SHALL be `zh-CN`

