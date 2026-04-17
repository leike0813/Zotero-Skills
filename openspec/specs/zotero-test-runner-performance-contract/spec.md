# zotero-test-runner-performance-contract Specification

## Purpose
TBD - created by archiving change zotero-test-runner-starvation-hardening. Update Purpose after archive.
## Requirements
### Requirement: Progress events MUST NOT block the Zotero GUI thread

The generated Zotero test runner MUST treat ordinary progress events as
non-blocking work.

#### Scenario: Progress events use lightweight delivery

- **WHEN** the runner emits `start`, `suite`, `suite end`, `pending`, or `pass`
  progress events
- **THEN** it does not synchronously await completion of the local reporter
  round-trip before continuing the Mocha event path

#### Scenario: Failure and completion remain authoritative

- **WHEN** the runner emits `fail`, `end`, or explicit diagnostic `debug` events
- **THEN** those events remain strongly ordered and blocking so terminal failure
  reporting is not dropped

### Requirement: The runner MUST avoid heavyweight default console object logging

The generated Zotero test runner MUST NOT emit full `suite`, `test`, or `error`
objects through default console logging.

#### Scenario: Default runner logging avoids Mocha object dumps

- **WHEN** the runner handles a Mocha lifecycle event
- **THEN** it does not call default `console.log(...)` with live `suite`, `test`,
  or `error` objects

### Requirement: Test page output MUST use append-only text rendering

The generated test page MUST render textual progress without repeated full-text
rewrites.

#### Scenario: Progress output appends to a persistent text node

- **WHEN** visible progress text is added to the runner page
- **THEN** the runner appends to a persistent text node or equivalent append-only
  structure
- **AND** it does not use `innerText += ...` style full-content rewrites

### Requirement: Failure diagnostics MUST remain available after hardening

Performance hardening MUST NOT remove the current failure-diagnostic bridge.

#### Scenario: Failure still reports rich diagnostics

- **WHEN** a test fails in the Zotero runner
- **THEN** the terminal still receives failure detail including test identity and
  stack information
- **AND** project-level failure-context emitters can continue to attach runtime
  log tail diagnostics

