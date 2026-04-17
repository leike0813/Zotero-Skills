## ADDED Requirements

### Requirement: Full suite SHALL serve as the stable CI host-coverage gate

Zotero `full` SHALL be a strict superset of Zotero `lite`, but its purpose is
not merely to add a narrow parity ring. Its purpose is to provide stable
real-host coverage for CI gate use.

#### Scenario: Zotero full prioritizes stable host coverage over speed

- **WHEN** Zotero `full` routine suites are selected
- **THEN** they MUST include every retained `lite` case
- **AND** they MUST add stable real-host suites or guards that improve coverage
  across major host-risk buckets
- **AND** they MUST not be optimized primarily for speed

#### Scenario: Zotero full is evaluated by coverage buckets

- **WHEN** Zotero `full` routine suites are curated
- **THEN** they MUST cover:
  - Zotero object lifecycle
  - SkillRunner transport/state/reconcile
  - workflow host context and idempotency
  - UI host shell behavior
- **AND** a full suite is incomplete when one of these buckets has no retained
  stable real-host coverage
