# Design: skillrunner-state-replay-ssot-alignment

## 1. Core Decisions

1. **Single truth source**: backend jobs semantics.
2. **Dual stream consumption**:
   - events stream for state
   - chat stream for display
3. **Plugin observer-only** for non-terminal states.
4. **Terminal exception**:
   - terminal may be committed by jobs confirmation without `state.changed`.
5. **Reconciler scope reduction**:
   - no non-terminal progression logic.

## 2. Data Model

Minimal request ledger entry:

- requestId
- snapshot
- backendId/backendType/backendBaseUrl
- workflowId/workflowLabel/taskName
- runId/jobId
- reconcileFlag
- updatedAt/error

No local inferred transition graph is persisted.

## 3. Write Gates

### NonTerminalWriteGuard

`queued/running/waiting_user/waiting_auth`:

- accepted only from events stream (`conversation.state.changed`)
- rejected from reconciler jobs polling path

### TerminalOverrideGuard

`succeeded/failed/canceled`:

- accepted from jobs terminal double-confirm path
- used for backend failure normalization where terminal event is missing

## 4. Sync Architecture

### Request Session Sync Manager

Per `requestId`:

1. events/history catch-up
2. events SSE reconnect loop
3. chat/history catch-up
4. chat SSE reconnect loop

Events channel updates ledger non-terminal snapshots through write guard.
Chat channel only updates conversation projection.

### Reconciler

Responsibilities:

1. reachability/backoff coordination
2. terminal jobs double-confirm
3. `succeeded` -> applyResult once
4. `failed/canceled` -> terminal toast

Non-responsibilities:

- no non-terminal rewriting
- no guessed downgrade on backend unreachable

## 5. Startup Strategy

1. load request ledger
2. auto-connect only records with `snapshot=running`
3. for waiting snapshots, defer reconnect to run UI open
4. backend unreachable keeps snapshot and sets `reconcileFlag=true`

## 6. UI Read Path

Status display surfaces must read unified snapshot lineage:

- dashboard home/backend tabs
- run workspace left tab labels
- run banner status

Conversation display reads chat channel.

## 7. Failure Boundaries

### Backend unreachable

- keep last-known snapshot
- retry with degraded backoff
- do not clean task or overwrite to running fallback

### Backend hard failure without terminal event

- terminal gathered from jobs double-confirm
- propagate terminal snapshot to all UI surfaces

### Frontend apply failure

- terminal snapshot remains terminal
- apply error tracked separately

## 8. Migration

No protocol change to backend.
Frontend migration is internal:

- old deferred context persistence remains for compatibility during transition
- status write authority moves to guarded ledger path

