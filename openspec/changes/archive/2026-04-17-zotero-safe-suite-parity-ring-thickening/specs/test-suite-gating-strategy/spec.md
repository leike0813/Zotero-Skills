## MODIFIED Requirements

### Requirement: Lite suite SHALL be explicitly optimized for fast feedback

`lite` suite membership SHALL be reviewed and pruned to keep PR feedback fast
while preserving critical-path confidence.

#### Scenario: Zotero lite retains a daily real-host regression ring

- **WHEN** Zotero `lite` routine suites are selected
- **THEN** they MUST include host smoke plus a small set of real-host parity
  cases for object operations, backend handoff, workflow context, and UI shell
  behavior
- **AND** they remain substantially smaller than broad historical Zotero
  coverage

#### Scenario: Zotero full remains a strict superset of Zotero lite

- **WHEN** Zotero `full` routine suites are selected
- **THEN** they MUST execute every retained `lite` case
- **AND** they MUST add an extra parity ring of guard, idempotency, and
  real-host regression cases

#### Scenario: Workflow Zotero coverage uses lite baseline plus full parity

- **WHEN** a workflow package is retained in routine Zotero execution
- **THEN** `lite` MUST keep a canonical success path and only the smallest
  necessary host-parity guards
- **AND** `full` MAY add a small number of extra host-safe guards without
  reintroducing deep matrix coverage
