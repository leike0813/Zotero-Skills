## ADDED Requirements

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
Tags in `suggest_tags` MUST NOT be written directly to parent items.

#### Scenario: Skill returns suggest_tags
- **WHEN** output contains non-empty `suggest_tags`
- **THEN** workflow SHALL surface them in summary/log channel
- **AND** SHALL NOT auto-add them to parent item tags
