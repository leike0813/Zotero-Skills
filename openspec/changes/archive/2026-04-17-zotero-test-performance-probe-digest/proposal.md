## Why

`zotero-test-leak-probe-digest` showed that current tail degradation is not
explained by simple container-style residual growth. The next diagnostic step
must measure cost growth directly: operation duration, event-loop lag, and
host resource growth.

## What Changes

- Add an opt-in performance probe digest for real Zotero tests.
- Record timing spans for key real-host operations.
- Record event-loop lag and host resource snapshots at shared lifecycle phases.
- Write the digest JSON under `artifact/test-diagnostics/`.
- Move the existing leak probe default output from `build/test-diagnostics` to
  `artifact/test-diagnostics`.

## Impact

- No workflow business behavior changes.
- Performance probe remains opt-in behind `ZOTERO_TEST_PERF_PROBE`.
- The leak probe and performance probe become the two-step diagnosis path for
  future tail degradation.

