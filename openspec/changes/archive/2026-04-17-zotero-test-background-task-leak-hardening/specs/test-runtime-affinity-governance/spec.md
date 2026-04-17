## ADDED Requirements

### Requirement: Zotero routine suites MUST leave no background work behind

Real Zotero tests MUST NOT leak background timers, session sync loops,
reconcilers, or comparable module-level work across test-case boundaries.

#### Scenario: Loop-starting tests perform symmetric teardown

- **WHEN** a test explicitly starts startup or background-loop behavior
- **THEN** the test or the shared Zotero harness shuts it down before the next
  test begins

#### Scenario: Test-only reset APIs exist for global timer holders

- **WHEN** a module owns dialog-level timers, listeners, or singleton state that
  can survive a test
- **THEN** it exposes a test-only reset or stop API that the shared Zotero
  teardown harness can call
