## MODIFIED Requirements

### Requirement: Suggested tags SHALL remain advisory outputs
Tags in `suggest_tags` MUST NOT be written directly to parent items, and SHALL support user-confirmed intake into controlled vocabulary or staged inbox.

#### Scenario: Suggest intake dialog supports immediate row actions
- **WHEN** output contains non-empty `suggest_tags`
- **THEN** workflow SHALL open a suggest-intake dialog with row-level `加入` and `拒绝` actions
- **AND** row-level `加入` SHALL write directly to controlled vocabulary on success and remove the row
- **AND** row-level `拒绝` SHALL discard the row immediately

#### Scenario: Global actions include join/stage/reject
- **WHEN** suggest-intake dialog is open
- **THEN** global actions SHALL be `全部加入` / `全部暂存` / `全部拒绝`
- **AND** `全部加入` SHALL keep invalid rows visible with diagnostics
- **AND** `全部暂存` SHALL write remaining rows to staged inbox
- **AND** `全部拒绝` SHALL discard all remaining rows

#### Scenario: Timeout and manual close default to staged intake
- **WHEN** suggest-intake dialog reaches 10-second timeout
- **THEN** system SHALL execute staged intake for all remaining rows and close the dialog
- **AND WHEN** user manually closes the dialog
- **THEN** system SHALL apply the same default staged-intake policy

#### Scenario: Suggest-intake summary is deterministic
- **WHEN** suggest-intake completes
- **THEN** workflow SHALL return deterministic summary fields including `addedDirect`, `staged`, `rejected`, `invalid`, `timedOut`, and `closePolicyApplied`
