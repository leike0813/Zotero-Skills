## MODIFIED Requirements

### Requirement: Tag manager bridge SHALL expose staged persistence APIs
The global tag vocabulary bridge MUST provide staged-state read/write APIs for cross-workflow integration.

#### Scenario: Tag-regulator writes remaining suggest tags into staged inbox
- **WHEN** tag-regulator suggest-intake executes staged path (global stage, timeout, or close default)
- **THEN** workflow SHALL persist remaining suggested tags through staged bridge methods
- **AND** persisted staged entries SHALL remain reviewable in Tag Manager staged inbox
- **AND** persisted entries SHALL carry `sourceFlow = tag-regulator-suggest`
