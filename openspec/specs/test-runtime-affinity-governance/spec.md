# test-runtime-affinity-governance Specification

## Purpose
TBD - created by archiving change test-governance-three-axis-realignment. Update Purpose after archive.
## Requirements
### Requirement: Test governance MUST classify runtime affinity explicitly

The project test suite MUST distinguish between `node-only`, `zotero-safe`, and
`zotero-unsafe` execution expectations.

#### Scenario: Mock-heavy helper test is classified as node-only

- **WHEN** a test relies on package helpers, runtime seams, fake DOM, or heavy
  mock injection
- **THEN** it SHOULD be classified as `node-only`

#### Scenario: Ordinary Zotero regression case stays zotero-safe

- **WHEN** a workflow or UI regression can run in Zotero without unstable
  multi-realm injection or real UI interaction
- **THEN** it MAY remain `zotero-safe`

### Requirement: Zotero-safe regressions MUST avoid real interactive UI

Regular Zotero-safe regression runs MUST NOT open real editor, file picker, or
dialog UI.

#### Scenario: Thickened Zotero lite/full still exclude unstable UI-heavy classes

- **WHEN** a test depends on editor, picker, dialog, GitHub sync, mock-e2e,
  brittle multi-realm override, or other deep unstable host chains
- **THEN** it MUST NOT return to the routine Zotero `lite` or `full` suites
- **AND** it remains covered by Node or separate non-routine execution

#### Scenario: Full parity ring restores only documented host-safe additions

- **WHEN** Zotero `full` expands beyond the `lite` baseline
- **THEN** it restores only the documented host-safe parity cases
- **AND** it MUST NOT implicitly re-enable all tests from a retained mixed file

### Requirement: Real Zotero tests MUST clean created library objects after each case

Real-host Zotero tests MUST NOT leave created parent items, notes, attachments,
or collections behind for subsequent tests.

#### Scenario: Shared teardown deletes tracked real Zotero objects

- **WHEN** a real Zotero test finishes
- **THEN** shared teardown deletes tracked library objects created during that
  test after background runtime cleanup completes

#### Scenario: Explicit direct-object creation is manually registered

- **WHEN** a real Zotero test creates Zotero items or collections directly
  without going through `handlers`
- **THEN** the test explicitly registers those objects for teardown cleanup

### Requirement: Tail degradation diagnosis MUST escalate to performance probe when residual probe is inconclusive

When real Zotero `full` runs still degrade toward the tail after residual leak probing, the next diagnosis step MUST be a staged performance probe digest before timeout inflation or suite reordering is attempted.

#### Scenario: Residual probe shows no actionable growth

- **WHEN** the leak probe digest shows no actionable post-cleanup growth outside naturally monotonic counters
- **THEN** engineers MUST enable the performance probe digest
- **AND** the next diagnosis pass MUST focus on operation duration, event-loop lag, and host resource growth

### Requirement: Zotero full expansion SHALL prioritize stable host coverage over unstable interaction paths

Routine Zotero execution SHALL thicken `full` using stable real-host suites,
while continuing to exclude known instability classes.

#### Scenario: Stable host suites are eligible for Zotero full

- **WHEN** a suite exercises real Zotero host behavior without relying on real
  editor, picker, or brittle dialog interaction
- **THEN** it MAY be promoted into Zotero `full` to improve stable host
  coverage

#### Scenario: Known unstable interaction classes remain excluded

- **WHEN** a suite depends on editor, picker, dialog, brittle multi-realm
  override, GitHub sync, or similarly unstable interaction paths
- **THEN** it MUST remain outside routine Zotero suites even if Zotero `full`
  is being thickened

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

