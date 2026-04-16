# test-taxonomy-domain-grouping Specification

## Purpose
TBD - created by archiving change restructure-test-taxonomy-by-domain. Update Purpose after archive.
## Requirements
### Requirement: Test inventory SHALL be classified into standard domains
The project test inventory SHALL be classified into `core`, `ui`, and `workflow-*` domains.

#### Scenario: Existing test is assigned to one primary domain
- **WHEN** a test file is reviewed during migration
- **THEN** it is assigned to exactly one primary domain

#### Scenario: New test follows domain taxonomy
- **WHEN** a new test is added
- **THEN** its location and naming comply with the domain taxonomy rules

### Requirement: Domain migration SHALL preserve traceability
Test reorganization SHALL include a migration map that records source and destination locations.

#### Scenario: Reviewer traces moved test
- **WHEN** reviewer inspects migrated tests
- **THEN** migration map provides old and new path mapping

#### Scenario: Fixture migration is auditable
- **WHEN** fixture files are moved
- **THEN** migration map includes fixture path changes and target domain ownership

### Requirement: Domain standards SHALL define naming and ownership rules
Each domain SHALL define naming conventions and maintenance ownership expectations.

#### Scenario: Domain naming rule exists
- **WHEN** standards are reviewed
- **THEN** each domain has documented naming conventions

#### Scenario: Domain ownership rule exists
- **WHEN** standards are reviewed
- **THEN** each domain has documented maintenance ownership expectations

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

