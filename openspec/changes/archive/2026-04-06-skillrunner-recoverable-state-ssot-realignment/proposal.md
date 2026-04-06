# Change: skillrunner-recoverable-state-ssot-realignment

## Why

SkillRunner plugin-side state handling currently drifts from the existing SSOT
contract after `requestId` creation:

- local dispatch/poll/fetch failures can incorrectly mark a still-running backend
  request as terminal `failed`
- plugin restart can restore that speculative `failed` view even while backend is
  still `running`
- the same request can later converge to backend `succeeded` and still execute
  `applyResult`, producing contradictory lifecycle semantics

This is not an SSOT redesign. Existing SSOT still stands:

- non-terminal state remains backend-observer-driven
- terminal convergence remains backend double-confirm driven
- plugin-side transport failure after `request-created` is not terminal failure

## What Changes

1. Tighten plugin-side semantics so `requestId`-created local failures remain
   recoverable non-terminal state.
2. Prevent foreground apply summary from counting those requests as terminal
   failed.
3. Prevent reconciler/context upsert from downgrading existing non-terminal
   context to speculative terminal `failed`.
4. Add regression coverage for:
   - request-created local failure
   - apply-seam pending classification
   - reconciler preservation of non-terminal context

## Impact

- No backend API changes.
- No new user-visible main status values.
- Existing SSOT docs are tightened, not replaced.
