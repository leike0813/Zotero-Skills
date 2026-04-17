# Design

## Persistence Model

`runtimeLogManager` remains the SSOT for in-memory log state. Persistence to
prefs becomes a deferred durability layer:

- append mutates in-memory state and marks persistence dirty
- a short debounce timer coalesces multiple appends into one prefs write
- only one pending timer may exist at a time
- forced flush clears the timer and writes immediately

This keeps the in-memory pipeline semantics unchanged while removing the
per-append full-document write amplification.

## Forced Flush Boundaries

Pending persistence must be flushed synchronously before operations that are
used as durability boundaries:

- `clearRuntimeLogs()`
- `snapshotRuntimeLogs()`
- `buildRuntimeDiagnosticBundle()`
- `buildRuntimeIssueSummary()`
- `hooks.onShutdown()`

Those boundaries already represent "make current runtime state observable or
durable now", so forcing persistence there preserves diagnostic correctness.

## Testability

The manager will expose a minimal `ForTests` persistence snapshot with:

- dirty flag
- pending timer presence
- flush count

Tests use that probe to assert batching semantics without coupling to internal
timer implementation details.

## Out of Scope

- no runtime log schema changes
- no retention budget changes
- no diagnostic bundle shape changes
- no fixes for unrelated session-sync runtime snapshot tests
