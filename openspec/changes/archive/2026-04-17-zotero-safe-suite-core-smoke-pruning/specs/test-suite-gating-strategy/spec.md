## MODIFIED Requirements

### Requirement: Lite suite SHALL be explicitly optimized for fast feedback

`lite` suite membership SHALL be reviewed and pruned to keep PR feedback fast
while preserving critical-path confidence.

#### Scenario: Zotero routine runs keep only core smoke and host parity

- **WHEN** Zotero routine suites are classified for regular `lite` or `full`
  execution
- **THEN** they retain only core smoke and a small set of real-host parity
  cases
- **AND** deep logic, helper, and matrix coverage continues in Node-oriented
  regression suites

#### Scenario: Workflow Zotero routine coverage stays package-smoke sized

- **WHEN** a workflow package is kept in routine Zotero runs
- **THEN** only 1-2 canonical success or host-specific smoke cases remain in
  the routine suite
- **AND** broader compatibility and edge-path coverage is moved to Node or
  `full`-only execution
