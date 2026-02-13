## ADDED Requirements

### Requirement: The project SHALL define two normative test suites
The project SHALL define two normative test suites: `lite` for pull request gating and `full` for release gating.

#### Scenario: PR gate uses lite suite
- **WHEN** a pull request gate runs
- **THEN** it executes the `lite` suite

#### Scenario: Release gate uses full suite
- **WHEN** a release gate runs
- **THEN** it executes the `full` suite

### Requirement: Full suite SHALL be a superset of lite suite
`full` suite membership SHALL include all tests in `lite` plus additional deep regression coverage.

#### Scenario: Suite inclusion relationship is validated
- **WHEN** suite definitions are reviewed
- **THEN** every `lite` member is present in `full`

#### Scenario: Additional deep tests are only in full
- **WHEN** environment-heavy or long-running tests are classified
- **THEN** they are allowed in `full` without being required in `lite`

### Requirement: CI gating behavior SHALL define blocking semantics
The CI strategy SHALL define blocking vs warning behavior for each gate job.

#### Scenario: Blocking gate failure
- **WHEN** `lite` PR gate fails or `full` release gate fails
- **THEN** the corresponding pipeline is marked failed

#### Scenario: Non-blocking informational job failure
- **WHEN** a non-gating informational job fails
- **THEN** it is reported as warning without overriding mandatory gate results

