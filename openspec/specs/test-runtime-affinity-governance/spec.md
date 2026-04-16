# test-runtime-affinity-governance Specification

## Purpose
TBD - created by archiving change test-governance-three-axis-realignment. Update Purpose after archive.
## Requirements
### Requirement: Test governance MUST classify runtime affinity explicitly

The project test suite MUST distinguish between `node-only`, `zotero-safe`, and
`zotero-unsafe` execution expectations.

#### Scenario: Mock-heavy helper test is classified as node-only

- **WHEN** a test relies on package helpers, runtime seams, fake DOM, or heavy
  mock injection
- **THEN** it SHOULD be classified as `node-only`

#### Scenario: Ordinary Zotero regression case stays zotero-safe

- **WHEN** a workflow or UI regression can run in Zotero without unstable
  multi-realm injection or real UI interaction
- **THEN** it MAY remain `zotero-safe`

### Requirement: Zotero-safe regressions MUST avoid real interactive UI

Regular Zotero-safe regression runs MUST NOT open real editor, file picker, or
dialog UI.

#### Scenario: Interactive test is excluded from Zotero-safe

- **WHEN** a test can open a real editor, file picker, or dialog
- **THEN** it MUST be skipped in Zotero-safe runs or migrated to `node-only`

#### Scenario: Governance review preserves stable Zotero runs

- **WHEN** a new Zotero-facing regression is added
- **THEN** reviewers verify that it does not depend on real interactive UI
  opening

