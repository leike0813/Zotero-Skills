# Change: skillrunner-backend-reconcile-gating-and-stream-lifecycle

## Why

Current SkillRunner replay and reconcile behaviors still have two core problems:

1. Stream lifecycle is over-connected (chat/event streams can remain active longer than needed), which increases backend pressure and causes noisy re-sync behavior.
2. Reachability gating is request-scoped instead of backend-scoped, so UX and routing remain inconsistent when one backend is unreachable.

The result is user-visible drift and meaningless run dialog entry points for tasks that cannot be reconnected.

## What Changes

1. Introduce backend-level reconcile gating (`backendId` scoped reachability + backoff state).
   - health probe endpoint: `HEAD/GET /v1/system/ping`
   - degrade cadence: `5s -> 15s -> 60s`
   - enter gate after two consecutive failures
   - recover on first success
2. Enforce stream lifecycle rules:
   - chat SSE only for the selected session in singleton run dialog
   - event SSE only for `snapshot=running`
   - event SSE disconnect immediately on `waiting_*` or terminal
3. Narrow reconciler to:
   - backend reachability coordination
   - terminal double-confirm convergence
   - terminal side effects (applyResult once for succeeded, terminal toasts)
4. Apply backend-gating UX rules:
   - block run dialog entry for flagged backends
   - filter flagged backends in submit settings profile selector
   - disable flagged backend tabs/groups and hide flagged backend tasks where specified
5. Keep observer-only state semantics:
   - non-terminal by events
   - terminal by jobs confirm path

## Impact

- No external event/API name breakage.
- Internal reconciliation architecture changes:
  - request-level reachability flagging -> backend-level gating
  - broad stream ownership -> strict lifecycle ownership
- UI behavior becomes explicitly gated under backend unreachable conditions, reducing invalid interactions.
6. Backend profile deletion takes effect immediately for reconcile:
   - removed backend leaves health probe queue immediately
   - active streams for that backend are stopped immediately
7. Consolidate task-state persistence into plugin-scope SQLite store:
   - new plugin-level state DB path: `<DataDirectory>/zotero-skills/state/zotero-skills.db`
   - replace runtime source of `skillRunnerDeferredTasksJson`, `skillRunnerRequestLedgerJson`, `taskDashboardHistoryJson`
   - run one-time migration from legacy prefs JSON to SQLite and clear legacy keys afterward
