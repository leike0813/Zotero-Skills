## ADDED Requirements

### Requirement: Tag-regulator suggest tags SHALL be reconciled against current local state before intake
When `tag-regulator` applies a successful backend result, returned `suggest_tags` MUST be reconciled against the latest local controlled vocabulary and staged inbox before suggest-intake dialog handling begins.

#### Scenario: Returned suggest tag is already controlled at result time
- **WHEN** backend returns `suggest_tags` containing a tag that already exists in local controlled vocabulary
- **THEN** that tag SHALL NOT appear in the suggest dialog
- **AND** that tag SHALL be exposed as `reclassified_add_tags`
- **AND** that tag SHALL participate in the same downstream item-mutation path as `add_tags`

#### Scenario: Returned suggest tag is already staged at result time
- **WHEN** backend returns `suggest_tags` containing a tag that already exists in local staged inbox
- **THEN** that tag SHALL NOT appear in the suggest dialog
- **AND** that tag SHALL be exposed as `reclassified_staged`
- **AND** the workflow SHALL NOT write a duplicate staged entry
