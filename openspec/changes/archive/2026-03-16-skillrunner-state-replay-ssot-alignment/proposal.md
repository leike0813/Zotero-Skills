# Change: skillrunner-state-replay-ssot-alignment

## Why

Current SkillRunner replay logic mixes multiple local status sources, causing drift:

- dashboard / workspace tabs / run banner can diverge
- restart replay for `waiting_user` / `waiting_auth` can degrade to `running`
- reconciler has historically exceeded scope and attempted non-terminal driving

This change resets the model to an e2e-aligned observer architecture.

## What Changes

1. Rebuild state SSOT with strict write guards:
   - non-terminal from events only
   - terminal from jobs-confirm path
2. Introduce minimal request ledger (`requestId + snapshot + minimal metadata + reconcileFlag`).
3. Introduce request session sync manager (events/chat dual-stream with catch-up and reconnect).
4. Narrow reconciler to reachability/backoff + terminal confirmation + apply/terminal toast.
5. Make UI consume unified snapshot lineage for status surfaces.
6. Rewrite related SSOT/spec artifacts to remove old polling-driven semantics.

## Impact

- No breaking external event names.
- Internal architecture changes substantially:
  - from mixed local drivers
  - to backend-observed single-truth projection
- Status consistency after restart and disconnection improves, especially waiting-state replay.

