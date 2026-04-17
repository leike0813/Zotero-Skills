## MODIFIED Requirements

### Requirement: Zotero routine suites MUST leave no background work behind

Real Zotero tests MUST NOT leak background timers, event streams, reconcilers,
or comparable module-level async work across test-case boundaries.

#### Scenario: Async background modules support stop-and-drain

- **WHEN** a module owns long-lived async work such as polling loops, event
  streams, or chat observers
- **THEN** it exposes a stop-and-drain lifecycle so test teardown can wait for
  in-flight work to exit before the next test begins

#### Scenario: Shared cleanup awaits async resets

- **WHEN** the shared Zotero cleanup harness tears down SkillRunner test state
- **THEN** it awaits async reset APIs instead of issuing stop-only cleanup
