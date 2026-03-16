## ADDED Requirements

### Requirement: Core SkillRunner observation contracts MUST be invariant-locked

The plugin MUST maintain machine-verifiable invariants for core SkillRunner observation behavior.

#### Scenario: provider/workspace core contracts are invariant-covered

- **WHEN** invariant files are validated
- **THEN** they MUST cover at least state sets, write-source gates, backend health cadence and thresholds, stream lifecycle gates, startup reconnect scope, and backend-flagged UI gating
- **AND** any missing required contract category MUST fail validation
- **AND** provider invariant IDs MUST include `INV-PROV-STATE-SETS`, `INV-PROV-WRITE-NONTERMINAL-EVENTS`, `INV-PROV-WRITE-TERMINAL-JOBS`, `INV-PROV-BACKEND-HEALTH-BACKOFF`, `INV-PROV-BACKEND-HEALTH-THRESHOLDS`, `INV-PROV-STREAM-EVENT-RUNNING-ONLY`, `INV-PROV-STARTUP-RUNNING-ONLY-RECONNECT`, `INV-PROV-UI-GATING-BACKEND-FLAG`

### Requirement: Invariant guard MUST be a blocking CI gate

Invariant drift MUST be blocked in both PR and release pipelines.

#### Scenario: CI blocks on invariant guard failure

- **WHEN** `check:ssot-invariants` fails
- **THEN** `test:gate:pr` and `test:gate:release` MUST fail
- **AND** test suite execution MUST NOT proceed as a replacement for failed invariant validation
