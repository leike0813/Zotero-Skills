## ADDED Requirements

### Requirement: Domain taxonomy SHALL stay separate from runtime affinity

Primary test domain and runtime-affinity classification MUST be treated as
orthogonal concepts.

#### Scenario: Test keeps one primary domain and one runtime affinity

- **WHEN** a test file is reviewed for governance
- **THEN** it remains assigned to exactly one primary domain
- **AND** it MAY additionally be classified as `node-only`, `zotero-safe`, or
  `zotero-unsafe`

#### Scenario: New runtime-affinity label does not replace domain ownership

- **WHEN** a new test is added
- **THEN** its location continues to follow primary domain taxonomy
- **AND** runtime-affinity guidance supplements rather than replaces the domain
  grouping rules
