# Design: zotero-full-gate-process-splitting

## Execution Topology

The `full` suite keeps the same membership and gate meaning, but its execution
topology changes.

Before:

- one `test:zotero:full` command
- one long-lived real-host Zotero process
- all retained `core`, `ui`, and `workflow` full cases executed in sequence

After:

- `test:zotero:full` becomes a wrapper
- the wrapper runs three independent real-host processes in order:
  1. `test:zotero:core:full`
  2. `test:zotero:ui:full`
  3. `test:zotero:workflow:full`

## Rationale

Recent diagnostics established:

- tail degradation is not explained by residual container growth alone
- repeated host writes, especially `saveTx()`, are amplified in long single
  Zotero runs
- isolated process comparison shows that execution topology is part of the
  problem, not just individual test content

Therefore the gate should optimize for:

- stable host coverage
- repeatable CI behavior
- bounded per-process endurance

It should not require one single Zotero process to absorb the whole retained
`full` surface.

## Non-goals

- No change to `lite` execution
- No change to `full` membership or allowlists
- No new shard taxonomy beyond existing first-level domains
- No change to `run-zotero-test-with-mock.ts` runner semantics

## Script Contract

The new wrapper script:

- runs the three existing Zotero full domain commands in order
- streams stdout/stderr directly
- exits immediately on the first failing stage
- prints explicit stage boundaries for CI logs

This keeps the current gate surface stable while changing only the process
topology behind it.
