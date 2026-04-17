## Why

Recent Zotero environment runs exposed a new failure mode in the generated test
runner itself: during medium or large suites, the runner can intermittently drag
the entire desktop into severe UI latency even when CPU and memory remain
within normal bounds. The observed symptoms point to a runner-side starvation
problem rather than business-test cost:

- progress output in the terminal slows down and drifts from real execution,
- Zotero window interaction becomes sluggish,
- other windows across the operating system also become noticeably delayed.

The existing runner patch already improved default exit behavior and failure
diagnostics. This change focuses on the next problem that surfaced after that
baseline: the generated runner is still too heavy on the GUI thread.

## What Changes

- Harden the generated Zotero test runner against GUI starvation by changing its
  default event transport strategy from fully blocking to mixed lightweight
  delivery.
- Remove heavyweight default `console.log` calls that pass full `suite` / `test`
  / `error` objects through the Firefox/Zotero console backend.
- Replace full-text DOM rewrites in the test page with append-only text output.
- Preserve the existing failure diagnostics path (`fullTitle`, stack, runtime
  log tail) without expanding the default diagnostic surface.

## Capabilities

### New Capabilities

- `zotero-test-runner-performance-contract`: Generated Zotero test runners use
  a non-starving event transport and append-only output strategy while
  preserving failure diagnostics.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `scripts/patch-zotero-test-runner.ts`
  - `test/node/core/91-zotero-test-infrastructure.test.ts`
  - `test/zotero/diagnosticBridge.ts`
- No backend protocol changes.
- No workflow behavior or test-scope governance changes in this change.
