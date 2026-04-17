# runtime-log-persistence-batching-hardening

## Why

`runtimeLogManager` currently persists the full retained log document to prefs on
every `appendRuntimeLog()` call. Under 2000+ append pressure, that turns normal
retention tests into an O(n²) hot path and creates unstable node test timeouts.

Recent node failures show the problem is not a schema or retention regression.
It is the persistence strategy itself:

- append keeps rewriting the entire `runtimeLogsJson` payload
- retention pressure tests exercise 2000+ writes in one process
- the log manager remains functionally correct, but the persistence path is too
  expensive for stable regression testing

## What Changes

- switch runtime log prefs persistence from per-append full writes to short
  batched persistence
- keep runtime logs memory-first during append
- force-flush pending persistence before:
  - `clearRuntimeLogs()`
  - `snapshotRuntimeLogs()`
  - `buildRuntimeDiagnosticBundle()`
  - `buildRuntimeIssueSummary()`
  - plugin shutdown
- add minimal test-only persistence state probes for flush/dirtiness visibility
- update runtime log tests to assert durability semantics instead of depending
  on per-append synchronous prefs writes

## Impact

- append hot path becomes substantially cheaper without changing log schema,
  filtering, retention budgets, or export bundle shape
- diagnostics/export/shutdown keep deterministic persisted state
- node regression coverage remains focused on contract behavior rather than
  accidental persistence timing
