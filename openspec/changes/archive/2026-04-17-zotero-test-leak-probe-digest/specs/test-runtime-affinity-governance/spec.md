## ADDED Requirements

### Requirement: Real Zotero tail degradation diagnosis MUST use staged leak evidence before timeout inflation

When a real Zotero routine or full suite becomes materially slower toward the tail of the run, the investigation MUST first collect staged lifecycle evidence instead of immediately changing timeout budgets or execution ordering.

#### Scenario: Shared leak probe digest is used before timeout inflation

- **WHEN** Zotero `full` shows tail-end slowdown or flaky timeout drift
- **THEN** the test infrastructure MUST support an opt-in staged leak probe
  digest
- **AND** the digest MUST capture at least test-start, pre-cleanup,
  post-background-cleanup, post-object-cleanup, and domain-end snapshots
- **AND** timeout increases or suite reordering MUST NOT be the first response
  unless the digest already rules out shared-runtime growth
