## ADDED Requirements

### Requirement: Tag manager SHALL provide a staged-tags inbox separate from controlled vocabulary
The workflow MUST persist staged tags independently from controlled vocabulary and allow users to review/edit them before promotion.

#### Scenario: Staged tags persist independently
- **WHEN** staged tags are saved
- **THEN** they SHALL be written to a dedicated staged persistence key
- **AND** controlled vocabulary persistence SHALL remain unchanged

#### Scenario: Corrupted staged payload fails safely
- **WHEN** staged payload is invalid JSON or invalid shape
- **THEN** loader SHALL return deterministic fallback state
- **AND** workflow SHALL NOT mutate controlled vocabulary

### Requirement: Tag manager SHALL allow immediate staged-tag actions
The staged inbox UI MUST support immediate actions for promote, discard, and clear-all.

#### Scenario: Promote staged tag to controlled vocabulary
- **WHEN** user clicks `加入受控词表` on a staged row
- **THEN** system SHALL validate the candidate against controlled vocabulary rules
- **AND** valid entry SHALL be persisted into controlled vocabulary
- **AND** promoted staged row SHALL be removed from staged persistence

#### Scenario: Promote rejects invalid tag
- **WHEN** candidate staged tag fails validation
- **THEN** controlled vocabulary SHALL remain unchanged
- **AND** staged row SHALL remain in staged persistence
- **AND** UI SHALL expose deterministic diagnostics

#### Scenario: Discard and clear are immediate
- **WHEN** user clicks row-level `拒绝/废弃`
- **THEN** that staged row SHALL be removed immediately
- **AND WHEN** user clicks `清空` and confirms
- **THEN** all staged rows SHALL be removed immediately

### Requirement: Tag manager bridge SHALL expose staged persistence APIs
The global tag vocabulary bridge MUST provide staged-state read/write/remove/clear APIs for cross-workflow integration.

#### Scenario: Bridge includes staged methods
- **WHEN** runtime bridge is registered
- **THEN** bridge SHALL expose staged-state methods in addition to existing controlled-vocabulary methods
