## Why

Recent Zotero `full` gates exposed a broader problem than test-only background
task leakage. The SkillRunner stack currently starts several long-lived async
loops with stop-only semantics:

- session sync event/history loops
- task reconciler background probes and reconcile rounds
- run dialog observer loops and waiting-auth polling
- local runtime background management loops

This is fragile in both real usage and test usage. In production, stop-only
lifecycles risk leaving stale async work alive during shutdown or UI close
transitions. In tests, those stale tasks bleed into later suites and manifest
as tail-end flakiness, repeated backend probe logs, and host slowdowns.

The fix is to establish a single lifecycle contract for SkillRunner async
modules: stop invalidates old work immediately, drain waits for in-flight work
to exit, and test resets use stop+drain.

## What Changes

- Add an SSOT SkillRunner async lifecycle contract to OpenSpec and governance
  docs.
- Refactor `skillRunnerSessionSyncManager` to use generation invalidation plus
  stop-and-drain helpers instead of stop-only session teardown.
- Align `skillRunnerTaskReconciler` and `skillRunnerSessionSyncManager` around
  the same lifecycle model.
- Upgrade `skillRunnerRunDialog` observer teardown from stop-only to
  stop-and-drain.
- Add a centralized `shutdownSkillRunnerAsyncLifecycle()` path and make
  `hooks.onShutdown()` truly async.
- Upgrade the Zotero test cleanup harness to await async SkillRunner resets.

## Impact

- Affected code:
  - `src/modules/skillRunnerSessionSyncManager.ts`
  - `src/modules/skillRunnerTaskReconciler.ts`
  - `src/modules/skillRunnerRunDialog.ts`
  - `src/modules/skillRunnerAsyncLifecycle.ts`
  - `src/modules/testRuntimeCleanup.ts`
  - `src/hooks.ts`
  - Node and Zotero lifecycle regression tests
- Production behavior changes are limited to lifecycle cleanup semantics. No
  request/result contract or workflow business rules change in this change.
