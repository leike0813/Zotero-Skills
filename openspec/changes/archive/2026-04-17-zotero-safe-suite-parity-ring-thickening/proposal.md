# Change: zotero-safe-suite-parity-ring-thickening

## Why

`zotero-safe-suite-core-smoke-pruning` successfully reduced routine Zotero
runtime cost, but the retained `lite` baseline became too thin to reliably
catch real-host drift in four high-risk areas:

- Zotero object operations and selection-context rebuilding
- Skill-Runner frontend/backend handoff
- workflow execution that depends on true Zotero context
- UI shell behavior in the real host

The next step is not to restore near-full Zotero execution. Instead, we thicken
the retained Zotero suite into a two-layer model:

- `zotero lite`: daily real-host regression set
- `zotero full`: gate-grade real-host parity ring

## What Changes

- Redefine Zotero `lite/full` responsibilities in governance docs and specs
- Promote a small set of host-parity tests into Zotero `lite`
- Add a second allowlist ring for Zotero `full` that expands coverage without
  reintroducing editor/picker/dialog and other unstable paths
- Keep Node coverage unchanged; only move real-host execution boundaries

## Impact

- `lite` remains much smaller than historical pre-pruning Zotero runs, but is
  no longer an ultra-thin smoke set
- `full` becomes a true key gate with broader real-host parity
- Real GUI-host drift should be caught earlier without reintroducing the major
  instability categories that were intentionally pruned
