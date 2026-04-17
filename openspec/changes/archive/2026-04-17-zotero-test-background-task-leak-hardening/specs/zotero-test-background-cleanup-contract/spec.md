## ADDED Requirements

### Requirement: Shared Zotero teardown MUST run after every test

The shared Zotero test setup MUST execute a unified background-runtime cleanup
after every test case regardless of pass or fail.

#### Scenario: Cleanup runs after success

- **WHEN** a Zotero test finishes successfully
- **THEN** the shared setup runs the unified background cleanup before the next
  test starts

#### Scenario: Cleanup runs after failure

- **WHEN** a Zotero test fails
- **THEN** the shared setup still runs the unified background cleanup before the
  next test starts

### Requirement: Failure diagnostics MUST be collected before cleanup

Cleanup MUST NOT erase the state needed for failure diagnostics before those
diagnostics are emitted.

#### Scenario: Diagnostics precede teardown

- **WHEN** a Zotero test fails
- **THEN** failure context such as test identity and runtime-log tail is
  collected and emitted first
- **AND** the unified background cleanup runs afterward
