## Context

The scaffold-generated Zotero test runner currently combines three expensive
behaviors on the GUI thread:

1. every Mocha lifecycle event performs an awaited local HTTP round-trip,
2. default logging emits full `suite` / `test` / `error` objects to the console,
3. page output uses `innerText += ...`, forcing repeated full-text rewrites.

In a real Windows GUI session, these costs do not necessarily manifest as high
CPU or exhausted memory. Instead they appear as message-loop starvation:
sluggish pointer interaction, delayed window operations, and visibly distorted
test progress cadence.

The previous infrastructure change already solved default `--no-watch`, startup
delay, and basic failure diagnostics. Those remain preconditions, not the work
of this change.

## Goals / Non-Goals

**Goals**

- Make the generated Zotero runner materially lighter on the GUI thread.
- Preserve current failure diagnostics quality.
- Keep the implementation entirely project-owned via `test:bundleTests` patching.
- Avoid changing the scaffold package or widening the project test surface.

**Non-Goals**

- No bundling optimization.
- No performance telemetry subsystem.
- No additional test-set pruning or runtime-affinity reclassification.
- No expansion of default debug output on successful runs.

## Decisions

### Decision 1: Use a mixed transport strategy

Runner event transport is split into two classes:

- **critical**: `fail`, `end`, and explicit `debug`
  - must remain blocking / strongly ordered
- **progress**: `start`, `suite`, `suite end`, `pending`, `pass`
  - must not block the Mocha event path

Implementation choice:

- keep the existing `/update` wire format,
- keep single-event payloads,
- introduce a lightweight local queue for progress events,
- drain that queue sequentially in the background,
- keep critical events on `await sendBlocking(...)`.

Rationale:

- avoids changing the parent reporter protocol,
- sharply reduces GUI-thread waiting,
- still keeps terminal progress reasonably fresh.

Rejected alternatives:

- full batching protocol: more invasive and unnecessary for this step.
- keeping all events blocking: directly preserves the starvation risk.

### Decision 2: Remove default object logging entirely

All default runner `console.log("...", suite/test/error)` calls are removed.

Rationale:

- Firefox/Zotero console processing of large live objects is disproportionately
  expensive,
- the runner already has structured terminal transport,
- failure diagnostics remain available through the explicit debug channel.

### Decision 3: Switch page output to append-only text nodes

The runner page keeps visible progress output, but it is implemented as a
single persistent `Text` node with `appendData(...)`.

Rationale:

- avoids quadratic-style `innerText += ...` rewrites,
- preserves current human-readable output,
- requires no new rendering abstraction.

### Decision 4: Keep failure diagnostics stable, not wider

The existing failure bridge remains:

- fail-detail debug payload,
- `window.onerror`,
- `window.onunhandledrejection`,
- project-level runtime-log-tail emission on failed tests.

This change does not add new default success-path diagnostics.

Rationale:

- avoids trading starvation for more output volume,
- keeps the debugging contract stable while fixing the heavy runner behavior.

## Risks / Trade-offs

- Progress events may arrive slightly later in the terminal.
  - Accepted: the change prefers GUI stability over perfectly synchronous
    progress cadence.
- Background progress sends may be dropped if the runner crashes hard.
  - Accepted: critical failure/end events remain blocking and authoritative.
- Patch anchors can drift when scaffold changes.
  - Mitigation: keep explicit fail-fast anchor checks and unit tests.

## Migration Plan

1. Update the runner patch helper to rewrite transport, output, and logging.
2. Tighten diagnostic bridge behavior so failure-context debug emission can be
   awaited.
3. Extend the patch-helper regression tests to cover:
   - no heavyweight console object logs,
   - no `innerText +=`,
   - mixed transport strategy.
4. Create the OpenSpec change artifacts and validate them.
5. Run Node regressions, typecheck, and a Zotero smoke run.
