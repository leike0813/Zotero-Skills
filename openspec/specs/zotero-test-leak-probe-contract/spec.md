# zotero-test-leak-probe-contract Specification

## Purpose
TBD - created by archiving change zotero-test-leak-probe-digest. Update Purpose after archive.
## Requirements
### Requirement: Real-host leak diagnosis MUST emit one structured probe digest

Real Zotero leak diagnosis MUST write a single structured digest file so root cause analysis can be based on snapshot evidence instead of console fragments.

#### Scenario: Probe digest records staged runtime surfaces

- **WHEN** `ZOTERO_TEST_LEAK_PROBE` is enabled
- **THEN** the shared Zotero test harness MUST record structured snapshots for
  each test lifecycle phase
- **AND** each snapshot MUST include runtime surfaces for reconciler,
  session sync, run dialog, local runtime, backend health, runtime logs,
  real-object cleanup tracking, and temp artifact tracking

#### Scenario: Digest includes computed suspicion summary

- **WHEN** the probe run finishes
- **THEN** the output JSON MUST include a summary of post-cleanup residuals
- **AND** it MUST compare head versus tail growth
- **AND** it MUST rank suspected metrics that remain non-zero after cleanup or
  grow across later tests

