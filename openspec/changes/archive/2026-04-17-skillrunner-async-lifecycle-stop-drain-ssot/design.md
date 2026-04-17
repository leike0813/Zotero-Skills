## Design

### Lifecycle SSOT

SkillRunner async modules must share one contract:

- `stop()`: invalidate the current generation immediately and prevent new
  background work from being scheduled
- `drain()`: wait for already-started background work from the invalidated
  generation to finish unwinding
- `resetForTests()`: `stop + drain + clear test-owned state`

Generation invalidation is only allowed at async loop boundaries and side-effect
boundaries after long awaits. It must not be injected into core workflow or
request business-state transitions.

### Session sync manager

`skillRunnerSessionSyncManager` currently starts `streamEventLoop()` as
fire-and-forget work and stops sessions by toggling flags and clearing maps.
That is insufficient because in-flight history/stream awaits can still complete
and continue writing backend health, runtime logs, or task projections after
stop.

The fix is:

- track session generations
- track in-flight session tasks
- make stop invalidate the session generation immediately
- make drain await all in-flight tasks
- make test reset async and await stop+drain before clearing caches/listeners

### Reconciler alignment

`skillRunnerTaskReconciler` already moved to generation invalidation and
stop-and-drain. This change keeps that boundary discipline and aligns naming,
calling convention, and shutdown orchestration with session sync.

### Run dialog observer lifecycle

`skillRunnerRunDialog` owns another async loop (`streamRunChat`) plus
waiting-auth polling and session-state subscriptions. Its current teardown is
stop-only. This change upgrades the observer lifecycle so close/reset/shutdown
paths await observer drain before clearing dialog-owned references.

### Production shutdown

`addon/bootstrap.js` already awaits `hooks.onShutdown()`. The missing piece is a
single async shutdown orchestration entrypoint for SkillRunner lifecycle
holders.

The shutdown sequence is:

1. stop and drain run dialog observers
2. stop task reconciler scheduling
3. stop and drain session sync loops
4. drain reconciler in-flight work
5. stop model-cache refresh
6. stop local runtime loops and release runtime lease

This order ensures reconciler work cannot relaunch session sync while session
drain is in progress.

### Test cleanup harness

The shared Zotero cleanup harness already runs after each real Zotero test. It
must remain ordered as:

1. collect failure diagnostics
2. run async cleanup harness

Within cleanup, all SkillRunner reset APIs must be awaited. Stop-only cleanup is
not sufficient for long-running async loops.
