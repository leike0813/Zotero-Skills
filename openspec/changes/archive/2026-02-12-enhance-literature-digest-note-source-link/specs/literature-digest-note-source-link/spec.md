## ADDED Requirements

### Requirement: Literature Digest SHALL Persist Source Markdown ItemKey In Digest Note Metadata
The workflow SHALL write the input markdown attachment `itemKey` into a hidden metadata block at the top of the digest note.

#### Scenario: Digest note includes source markdown itemKey
- **WHEN** `literature-digest` workflow finishes a valid markdown attachment job
- **THEN** the written digest note SHALL contain a hidden metadata block
- **AND** the metadata SHALL include `source_markdown_item_key`
- **AND** `source_markdown_item_key` value SHALL equal the processed markdown attachment `itemKey`

### Requirement: Source Metadata SHALL Be Hidden In Zotero Note Rendering
The source metadata block SHALL be machine-readable but not user-visible in Zotero note content.

#### Scenario: Hidden metadata is not shown as visible prose
- **WHEN** user opens the digest note in Zotero
- **THEN** the source metadata block SHALL not add visible textual content in the main rendered body
- **AND** external systems can still read the `data-zs-*` metadata attributes

### Requirement: Workflow SHALL Keep Existing Digest/References Output Contracts
Adding source metadata SHALL NOT break existing digest markdown payload and references note output behavior.

#### Scenario: Digest payload remains compatible
- **WHEN** digest note is written with source metadata
- **THEN** existing `digest-markdown` payload block SHALL still be present and valid

#### Scenario: References note remains unchanged
- **WHEN** workflow writes references note in the same run
- **THEN** references note structure and payload SHALL remain compatible with existing readers

### Requirement: Workflow SHALL Degrade Gracefully If Source ItemKey Is Unavailable
If the workflow cannot resolve a valid markdown source `itemKey`, it SHALL continue digest/references write flow without failing the whole job.

#### Scenario: Missing itemKey fallback
- **WHEN** runtime cannot resolve source markdown attachment `itemKey`
- **THEN** workflow SHALL still write digest and references notes
- **AND** source metadata field MAY be omitted for that run
