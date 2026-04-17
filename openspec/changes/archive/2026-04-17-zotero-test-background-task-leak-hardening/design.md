## Design

### Unified cleanup entrypoint

Real Zotero tests share a single process and therefore share module-level
singletons, timers, listeners, and persisted in-memory test state. The cleanup
strategy is to centralize teardown into one idempotent API:

- `cleanupBackgroundRuntimeForZoteroTests()`

The function stops or resets, in order:

1. UI/dialog surfaces that may hold subscriptions or timers
2. SkillRunner reconciler/session-sync background loops
3. model-cache and local-runtime periodic work
4. registries, ledgers, plugin state, and emitter overrides
5. runtime task/log tail state

The order matters because some later resets assume earlier loops are no longer
emitting work.

### Public test-only reset APIs

Some modules already exposed stop/reset helpers. Others held global timer or
dialog state without a public teardown surface. This change adds test-only reset
APIs to those modules rather than adding production logic branches.

### Global Zotero teardown harness

The common Zotero diagnostic bridge already owns the shared `afterEach`
infrastructure. That is the correct place to enforce cleanup for every test.

The hook order is:

1. collect failure diagnostics
2. emit failure context
3. run background cleanup

This preserves runtime logs for diagnostics and still guarantees teardown even
when a test fails.

### Local explicit teardown in loop-starting tests

Global cleanup is the safety net, not the only defense. Tests that explicitly
call startup/loop APIs should still perform symmetric local shutdown when that
shutdown is part of the test contract.
