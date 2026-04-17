# Change: zotero-full-gate-process-splitting

## Why

Current Zotero `full` execution runs `core + ui + workflow` in one long-lived
real-host Zotero process. Recent diagnostics showed that this execution model
creates strong tail degradation even when residual leak probes are clean.

The strongest findings were:

- repeated real-host `saveTx()` writes materially increase later test cost
- independent-process comparison showed that short idle gaps help, but do not
  eliminate the issue
- the worst amplification appears in long single-process endurance runs rather
  than in isolated domain runs

This means the current `full` gate is mixing two concerns:

- stable host coverage
- long single-process endurance

For CI gating, the first concern matters. The second is currently an unstable
amplifier that obscures signal and makes future full-suite growth risky.

## What Changes

- Change Zotero `full` execution from one monolithic real-host process to a
  sequential wrapper that runs:
  - `test:zotero:core:full`
  - `test:zotero:ui:full`
  - `test:zotero:workflow:full`
- Keep the `full` coverage contract unchanged
- Keep `test:gate:release` unchanged at the command surface
- Record the reason for the split in governance docs and delta specs

## Impact

- `full` still blocks release/main CI as the stable real-host coverage gate
- Tail degradation from single-process endurance is reduced without shrinking
  host coverage
- Future expansion of retained Zotero `full` cases becomes safer because each
  domain gets a fresh Zotero process
