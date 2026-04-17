## ADDED Requirements

### Requirement: Real-host performance diagnosis MUST emit one staged digest

Real Zotero performance diagnosis MUST write one structured digest so tail degradation can be attributed to cost growth rather than guessed from residual counts.

#### Scenario: Performance digest records spans and host snapshots

- **WHEN** `ZOTERO_TEST_PERF_PROBE` is enabled
- **THEN** the shared Zotero test harness MUST capture snapshots for `test-start`, `pre-cleanup`, `post-background-cleanup`, `post-object-cleanup`, and `domain-end`
- **AND** it MUST record timing spans for the retained real-host operations under diagnosis
- **AND** it MUST include event-loop lag and host resource metrics in the final JSON output

#### Scenario: Diagnostic outputs default to artifact directory

- **WHEN** no explicit output override is provided
- **THEN** performance and leak probe digests MUST default to `artifact/test-diagnostics/`

