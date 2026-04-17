## Why

Zotero `full` gates still show clear tail degradation: later tests become
slower or flaky only after many earlier tests have already run in the same real
Zotero process. Several cleanup hardening rounds reduced noise, but they did
not produce a decision-grade explanation of which shared runtime surface is
still growing and which cleanup phase fails to bring it back down.

The next step must be evidence collection, not more guesswork.

## What Changes

- Add an opt-in leak probe digest for real Zotero tests.
- Capture structured runtime snapshots at fixed lifecycle phases:
  `test-start`, `pre-cleanup`, `post-background-cleanup`,
  `post-object-cleanup`, and `domain-end`.
- Export read-only `ForTests` runtime snapshots from current high-risk modules.
- Record temp artifact creation for zip bundle extraction and tag-regulator
  valid-tags YAML materialization.
- Write one JSON digest with raw snapshots, computed summary, and ranked
  suspicion signals.

## Impact

- Affected code:
  - `test/zotero/diagnosticBridge.ts`
  - `test/zotero/leakProbeDigest.ts`
  - `src/modules/*ForTests` snapshot surfaces
  - `src/workflows/zipBundleReader.ts`
  - `workflows_builtin/tag-vocabulary-package/tag-regulator/hooks/buildRequest.mjs`
- No workflow business behavior changes.
- Probe is opt-in behind `ZOTERO_TEST_LEAK_PROBE`.
