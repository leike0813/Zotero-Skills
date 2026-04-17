## Why

Recent long-running Zotero `full` gates exposed a failure mode that does not
look like product regressions: later suites start timing out or drifting only
after many earlier suites have already run in the same real Zotero process.
The strongest hypothesis is leaked background work, especially SkillRunner
reconcilers, session sync loops, model-cache refresh timers, and local-runtime
auto-ensure loops that continue running after a test finishes.

The fix should target test teardown, not timeout inflation.

## What Changes

- Add a unified Zotero-test background cleanup harness in `src/modules`.
- Run that cleanup after every Zotero test, after failure diagnostics are
  collected.
- Add missing test-only reset APIs for global timer/listener holders such as
  the run dialog and task manager dialog.
- Tighten tests that explicitly start background loops so they also perform
  explicit local teardown instead of relying on process exit.

## Impact

- Affected code:
  - `src/modules/testRuntimeCleanup.ts`
  - `src/modules/skillRunnerSessionSyncManager.ts`
  - `src/modules/skillRunnerTaskReconciler.ts`
  - `src/modules/skillRunnerRunDialog.ts`
  - `src/modules/taskManagerDialog.ts`
  - `test/zotero/diagnosticBridge.ts`
  - targeted tests that start background loops
- No product behavior changes.
- No runner, bundling, or test-scope policy changes in this change.
