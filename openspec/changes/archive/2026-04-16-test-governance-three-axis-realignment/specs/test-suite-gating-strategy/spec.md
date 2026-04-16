## MODIFIED Requirements

### Requirement: Full suite SHALL be a superset of lite suite

`full` suite membership SHALL include all tests in `lite` plus additional deep
regression coverage.

#### Scenario: Additional deep tests are only in full

- **WHEN** environment-heavy, long-running, or intentionally down-tiered test
  cases are classified
- **THEN** they are allowed in `full` without being required in `lite`
- **AND** case-level `itFullOnly` gating MAY be used to keep those cases inside
  the same file while excluding them from `lite`

### Requirement: Lite suite SHALL be explicitly optimized for fast feedback

`lite` suite membership SHALL be reviewed and pruned to keep PR feedback fast
while preserving critical-path confidence.

#### Scenario: Lite membership changes remain auditable

- **WHEN** a case is moved out of `lite`
- **THEN** rationale and target suite placement are documented in suite
  governance artifacts
- **AND** the move MUST NOT require introducing a new runner contract beyond the
  existing `lite/full` entrypoints and `itFullOnly` mechanism
