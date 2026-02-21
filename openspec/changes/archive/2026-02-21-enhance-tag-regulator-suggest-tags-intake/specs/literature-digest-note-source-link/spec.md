## ADDED Requirements

### Requirement: Literature Digest language parameter declaration SHALL align with tag-regulator note language
`literature-digest` workflow language parameter declaration MUST stay aligned with `tag-regulator.tag_note_language` to keep language configuration semantics consistent across workflows.

#### Scenario: Literature digest language options match tag-regulator options
- **WHEN** workflow manifests are inspected
- **THEN** `literature-digest.parameters.language.enum` SHALL match `tag-regulator.parameters.tag_note_language.enum`
- **AND** both defaults SHALL be `zh-CN`
