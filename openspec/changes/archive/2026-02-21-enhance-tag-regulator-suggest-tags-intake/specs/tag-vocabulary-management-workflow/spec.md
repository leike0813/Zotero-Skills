## ADDED Requirements

### Requirement: Tag vocabulary ingestion SHALL support tag-regulator suggest-tag intake
The vocabulary persistence interface MUST accept selected `suggest_tags` from `tag-regulator` and enforce deterministic source/idempotency rules.

#### Scenario: Suggest-tag intake writes selected entries with fixed source
- **WHEN** `tag-regulator` submits selected `suggest_tags` for intake
- **THEN** vocabulary persistence SHALL write only selected entries
- **AND** each newly written entry SHALL set `source = agent-suggest`

#### Scenario: Suggest-tag intake preserves note field
- **WHEN** selected `suggest_tags` entries include `note`
- **THEN** vocabulary persistence SHALL store the corresponding `note` on inserted entries
- **AND** stored `note` SHALL remain associated with its selected `tag`

#### Scenario: Suggest-tag intake remains idempotent and validates format
- **WHEN** selected tags contain duplicates or invalid formats
- **THEN** existing tags SHALL be skipped without duplicate insertion
- **AND** invalid tags SHALL be rejected with deterministic diagnostics
