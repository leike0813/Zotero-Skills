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

### Requirement: Lite suite SHALL be explicitly optimized for fast feedback
`lite` suite membership SHALL be reviewed and pruned to keep PR feedback fast while preserving critical-path confidence.

#### Scenario: Stable deep regression case is excluded from lite
- **WHEN** a test case is identified as stable but non-essential for PR critical-path protection
- **THEN** it can be excluded from `lite` and retained in `full`

#### Scenario: Lite membership changes remain auditable
- **WHEN** a case is moved out of `lite`
- **THEN** rationale and target suite placement are documented in suite governance artifacts

### Requirement: Lite selection-context rebuild SHALL use mix-all top-3-parent subset
For `selection-context rebuild`, `lite` SHALL execute only a dedicated fixture derived from the first three parent entries of `selection-context-mix-all`.

#### Scenario: Lite rebuild scope uses top-3 parents only
- **WHEN** `selection-context rebuild` runs in `lite` mode
- **THEN** the test uses only the top-3-parent derived fixture and excludes standalone notes from `mix-all`

#### Scenario: Lite rebuild keeps artifacts
- **WHEN** the top-3-parent rebuild case completes in `lite`
- **THEN** rebuilt artifacts are preserved (no cleanup teardown)

#### Scenario: Full rebuild remains comprehensive
- **WHEN** `selection-context rebuild` runs in `full` mode
- **THEN** the existing comprehensive fixture matrix continues to run

### Requirement: CI gating behavior SHALL define blocking semantics
The CI strategy SHALL define blocking vs warning behavior for each gate job.

#### Scenario: Blocking gate failure
- **WHEN** `lite` PR gate fails or `full` release gate fails
- **THEN** the corresponding pipeline is marked failed

#### Scenario: Non-blocking informational job failure
- **WHEN** a non-gating informational job fails
- **THEN** it is reported as warning without overriding mandatory gate results

### Requirement: Grouped test commands SHALL be provided at first-level domains
The project SHALL provide grouped test commands for both Node and Zotero runs at first-level domains only: `core`, `ui`, and `workflow`.

#### Scenario: Node grouped command by first-level domain
- **WHEN** a developer runs a Node grouped command for `core`, `ui`, or `workflow`
- **THEN** only tests in the selected first-level domain are executed

#### Scenario: Zotero grouped command by first-level domain
- **WHEN** a developer runs a Zotero grouped command for `core`, `ui`, or `workflow`
- **THEN** only tests in the selected first-level domain are executed

#### Scenario: Per-workflow grouped commands are not required in this change
- **WHEN** grouped commands are defined for this change
- **THEN** command surface is limited to first-level domain groups and does not require per-workflow command variants
