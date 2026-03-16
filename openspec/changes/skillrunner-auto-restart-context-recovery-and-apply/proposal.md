# Change: skillrunner-auto-restart-context-recovery-and-apply

## Why

SkillRunner `auto` mode currently does not reliably recover terminal convergence and
`applyResult` after plugin restart, while `interactive` mode does.

Root issue: recoverable context is effectively bound to deferred-only registration
timing, so `auto` tasks can lose the apply trigger path after restart.

## What Changes

1. Unify recoverable context creation timing for both `auto` and `interactive`:
   create/ensure context at `request-created` as soon as `requestId` is available.
2. Change reconciler registration semantics from deferred-only to requestId-driven
   idempotent context upsert.
3. Keep local managed backend reconcile behavior unchanged:
   - excluded from startup full reconcile
   - reconciled once on `local-runtime-up`.
4. Add conservative handling for legacy running tasks with missing context:
   - keep status tracking
   - if terminal `succeeded` arrives without recoverable context, skip apply and
     show explicit user-facing warning.

## Impact

- No external API/event name breakage.
- Internal reconciler/context lifecycle behavior changes.
- `auto` restart behavior aligns with `interactive` for terminal/apply flow,
  except explicit legacy missing-context fallback.
