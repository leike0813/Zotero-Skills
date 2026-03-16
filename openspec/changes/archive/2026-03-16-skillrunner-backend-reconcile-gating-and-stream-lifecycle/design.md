# Design: skillrunner-backend-reconcile-gating-and-stream-lifecycle

## 1. Core Decisions

1. Backend jobs semantics remain SSOT for state convergence.
2. Reconcile gating is backend-scoped (not request-scoped).
3. Stream lifecycle is explicitly bounded by UI/session and state class:
   - chat stream: only active selected run session
   - event stream: only active while snapshot is `running`
4. Plugin is observer-only for non-terminal states.
5. Terminal can converge by jobs double-confirm, including no-`state.changed` failure paths.

## 2. Backend Health Registry

Introduce an in-memory backend health registry keyed by `backendId`:

- `reachable: boolean`
- `reconcileFlag: boolean`
- `backoffLevel: 0..3`
- `nextProbeAt: epochMs`
- `lastError?: string`

Probe cadence (degraded):

- level 0: 5s
- level 1: 15s
- level 2: 60s

Probe endpoint uses `HEAD/GET /v1/system/ping` only (no fallback to
`/v1/management/runs`).

Failure/success threshold:

- enter reconcile gate only after 2 consecutive probe failures
- recover immediately on first successful probe
- backoff level resets to 0 on recovery

This registry is runtime-only and rebuilt on startup.
When a backend profile is deleted, its backendId is removed from the registry
immediately and active stream sessions for that backend are stopped.

## 3. Stream Lifecycle Contract

Run dialog consumes backend state via global event projection subscription
(`events -> ledger -> dialog subscriber -> snapshot`), and must not rely on
periodic full-page refresh to drive status rendering.

### 3.1 Event Stream

- Auto-connect candidates on startup: `snapshot=running` only.
- Connect blocked when backend `reconcileFlag=true`.
- Disconnect immediately when projection becomes:
  - `waiting_user`
  - `waiting_auth`
  - terminal (`succeeded|failed|canceled`)

### 3.2 Chat Stream

- Run dialog is singleton.
- Only one selected session owns chat stream.
- On dialog close or selected session change:
  - old chat stream disconnects immediately.
- Chat stream never runs in background for non-selected sessions.

## 4. Reconciler Scope

Reconciler responsibilities:

1. maintain backend health probes and backoff transitions
2. restart eligible event connections when backend recovers
3. terminal double-confirm via jobs API
4. side effects after terminal confirm:
   - succeeded -> applyResult once
   - failed/canceled -> terminal toast once

Reconciler non-responsibilities:

- no non-terminal state rewriting
- no request-level reachability gating
- no chat stream ownership

## 5. UI Gating Rules (backend-level)

When backend `reconcileFlag=true`:

1. run dialog opening is blocked for tasks on that backend; user gets explicit localized reason.
2. submit-workflow settings dialog profile candidates exclude flagged backends.
3. if filtered set excludes current default profile, auto-switch default selection to first available candidate.
4. dashboard backend tab is marked unavailable and cannot be selected.
5. dashboard home running list hides tasks from flagged backends.
6. skillrunner run workspace left backend group is marked unavailable, non-expandable, non-interactive, and renders no task bubbles.

Default settings page remains unfiltered as configured.

## 6. Ledger and Write Guards

Ledger keeps minimal shape:

- requestId
- snapshot
- minimal presentation metadata

Request-level `reconcileFlag` is removed from write path (legacy field read-compatible, no new writes).

Write guard:

- non-terminal writes only from events channel
- terminal writes from jobs confirm path

## 7. Failure Boundaries

1. Backend unreachable:
   - keep last-known snapshot
   - enforce backend reconcile gating
   - do not clean tasks or downgrade status
2. Backend hard fail without terminal state event:
   - jobs double-confirm commits terminal
3. Frontend/apply failure:
   - task remains terminal
   - apply error recorded separately

## 8. Migration & Compatibility

- Existing external APIs/events stay unchanged.
- Internal consumers migrate from request-level reconcile checks to backend registry checks.
- Old ledger records with `reconcileFlag` are accepted for read; write-back omits field.

## 9. Persistence Refactor (SQLite, Plugin Scope)

Task-state persistence for this change is migrated to plugin-scope SQLite:

- DB file: `<Zotero.DataDirectory>/zotero-skills/state/zotero-skills.db`
- store entry module: `pluginStateStore` (generic plugin naming, not skillrunner-specific store naming)

Schema (domain-partitioned):

- `plugin_task_requests`
- `plugin_task_contexts`
- `plugin_task_rows`

Current runtime domain is `skillrunner`. Tables use domain + key primary constraints and indexes for:

- `(domain, backend_id, request_id)`
- `(domain, scope/state, updated_at DESC)`

Legacy prefs keys are migration input only:

- `skillRunnerDeferredTasksJson`
- `skillRunnerRequestLedgerJson`
- `taskDashboardHistoryJson`

One-time migration rule:

1. import legacy rows into SQLite
2. set migration meta version
3. clear legacy prefs keys
4. stop all runtime read/write on legacy keys
