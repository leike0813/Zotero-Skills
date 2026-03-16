# task-dashboard-skillrunner-observe Specification

## Purpose

Define canonical SkillRunner observation behavior in plugin dashboard/run workspace:

- backend jobs semantics as SSOT
- backend-level reconcile gating
- bounded stream lifecycle
- observer-only non-terminal semantics
## Requirements
### Requirement: SkillRunner backend reachability gating MUST be backend-scoped

Plugin MUST maintain reachability/reconcile gating at backend level and apply it consistently to connection and UI entry points.

#### Scenario: backend probe backoff progression

- **WHEN** a skillrunner backend becomes unreachable
- **THEN** plugin MUST set backend reconcile flag to true only after two consecutive probe failures
- **AND** probe interval MUST degrade by levels `5s -> 15s -> 60s`
- **AND** plugin MUST reset cadence to `5s` after backend recovers
- **AND** plugin MUST clear reconcile flag on first successful probe
- **AND** when a backend profile is deleted, plugin MUST remove it from probe queue immediately

#### Scenario: backend reconcile gating blocks run interaction paths

- **WHEN** backend reconcile flag is true
- **THEN** plugin MUST block run dialog opening for tasks on that backend
- **AND** submit-workflow profile selector MUST exclude that backend
- **AND** dashboard backend tab for that backend MUST be disabled
- **AND** run workspace backend group for that backend MUST be non-interactive with no task bubbles

#### Scenario: backend reconcile gating hides home running tasks

- **WHEN** backend reconcile flag is true
- **THEN** dashboard home running list MUST hide tasks belonging to that backend
- **AND** hidden tasks MUST remain stored (no cleanup side effect)

### Requirement: SkillRunner stream lifecycle MUST be bounded by state and session ownership

Plugin MUST minimize long-lived stream connections.

#### Scenario: chat stream singleton ownership

- **WHEN** run dialog selected session changes or dialog closes
- **THEN** previous session chat stream MUST disconnect immediately
- **AND** only selected session MAY keep active chat stream

#### Scenario: event stream running-only contract

- **WHEN** request snapshot is not `running`
- **THEN** plugin MUST keep event stream disconnected for that request
- **AND** upon transition to `waiting_user`/`waiting_auth`/terminal plugin MUST disconnect event stream immediately

### Requirement: SkillRunner non-terminal state MUST remain observer-only

Plugin MUST treat backend jobs semantics as the single truth for run state projection.

#### Scenario: non-terminal states are events-driven only

- **WHEN** plugin receives `conversation.state.changed` from events history/SSE
- **THEN** plugin MAY update non-terminal snapshot (`queued/running/waiting_*`)
- **AND** reconciler/jobs polling MUST NOT rewrite non-terminal states

#### Scenario: terminal states may be confirmed by jobs API

- **WHEN** backend failure path ends a run without terminal `state.changed`
- **THEN** plugin MUST allow terminal convergence from jobs double-confirm
- **AND** terminal state MUST fan out consistently to dashboard/workspace/banner

#### Scenario: restart replay preserves waiting state

- **WHEN** plugin restarts with existing waiting snapshot
- **THEN** first frame MUST render waiting snapshot
- **AND** refresh failure MUST NOT downgrade waiting to running fallback

#### Scenario: backend temporarily unreachable keeps last-known snapshot

- **WHEN** backend is temporarily unreachable during reconcile/sync
- **THEN** plugin MUST keep last-known snapshot unchanged
- **AND** plugin MUST set reconcile flag and retry with backoff
- **AND** plugin MUST NOT clean task or force running fallback

#### Scenario: dual stream catch-up on reconnect

- **WHEN** stream reconnect occurs
- **THEN** plugin MUST run `events/history -> events SSE` for state channel
- **AND** plugin MUST run `chat/history -> chat SSE` for display channel
- **AND** sequence continuity MUST be preserved (no duplicate replay in final UI projection)

### Requirement: Backend reconcile gating MUST control interaction entry points

#### Scenario: blocked run entry and disabled backend surfaces

- **WHEN** backend reconcile flag is true
- **THEN** plugin MUST block opening run dialog for tasks on that backend with explicit user-visible reason
- **AND** dashboard backend tab for that backend MUST be disabled
- **AND** skillrunner workspace backend group for that backend MUST be non-interactive and render no task bubbles

#### Scenario: submit profile filtering for flagged backends

- **WHEN** submit-workflow settings dialog is opened
- **THEN** backend profile selector MUST exclude flagged skillrunner backends
- **AND** if default selected profile is excluded, selector MUST auto-switch to another available profile
- **AND** default settings page profile list MUST remain unfiltered

#### Scenario: dashboard home list omits flagged backend tasks

- **WHEN** backend reconcile flag is true
- **THEN** dashboard home running list MUST hide tasks from that backend
- **AND** hidden tasks MUST remain persisted (no cleanup side effect)

### Requirement: Backend-unreachable state MUST preserve last-known snapshot

#### Scenario: unreachable backend does not trigger local speculative rewrite

- **WHEN** backend is temporarily unreachable
- **THEN** plugin MUST preserve last-known snapshot
- **AND** plugin MUST NOT clear task
- **AND** plugin MUST NOT force fallback status rewrite

### Requirement: Task-state persistence MUST use plugin-scope SQLite

Task-state persistence MUST use plugin-scope SQLite tables instead of legacy prefs JSON runtime sources.

#### Scenario: one-time migration from legacy prefs JSON

- **WHEN** plugin starts with legacy prefs task-state data present
- **THEN** plugin MUST migrate rows into plugin SQLite task tables exactly once
- **AND** plugin MUST clear legacy prefs keys after successful migration
- **AND** subsequent runtime reads/writes MUST come from SQLite only

#### Scenario: restart restore uses SQLite request/context/rows

- **WHEN** plugin restarts
- **THEN** request ledger, reconcile contexts, and dashboard/history rows MUST restore from SQLite state store
- **AND** dashboard home running and backend-tab task rows MUST be derived from the same restored active-row source

### Requirement: Core SkillRunner observation contracts MUST be invariant-locked

The plugin MUST maintain machine-verifiable invariants for core SkillRunner observation behavior.

#### Scenario: provider/workspace core contracts are invariant-covered

- **WHEN** invariant files are validated
- **THEN** they MUST cover at least state sets, write-source gates, backend health cadence and thresholds, stream lifecycle gates, startup reconnect scope, and backend-flagged UI gating
- **AND** any missing required contract category MUST fail validation
- **AND** provider invariant IDs MUST include `INV-PROV-STATE-SETS`, `INV-PROV-WRITE-NONTERMINAL-EVENTS`, `INV-PROV-WRITE-TERMINAL-JOBS`, `INV-PROV-BACKEND-HEALTH-BACKOFF`, `INV-PROV-BACKEND-HEALTH-THRESHOLDS`, `INV-PROV-STREAM-EVENT-RUNNING-ONLY`, `INV-PROV-STARTUP-RUNNING-ONLY-RECONNECT`, `INV-PROV-UI-GATING-BACKEND-FLAG`

### Requirement: Invariant guard MUST be a blocking CI gate

Invariant drift MUST be blocked in both PR and release pipelines.

#### Scenario: CI blocks on invariant guard failure

- **WHEN** `check:ssot-invariants` fails
- **THEN** `test:gate:pr` and `test:gate:release` MUST fail
- **AND** test suite execution MUST NOT proceed as a replacement for failed invariant validation

### Requirement: SkillRunner auto and interactive restart recovery MUST share one context chain

Plugin MUST bootstrap and maintain recoverable task context for both execution
modes using the same requestId-driven lifecycle.

#### Scenario: request-created bootstraps recoverable context for auto mode

- **WHEN** a skillrunner request emits `request-created` with `requestId`
- **THEN** plugin MUST create or upsert recoverable context immediately
- **AND** this behavior MUST apply to both `auto` and `interactive` execution modes
- **AND** context bootstrap MUST NOT depend on deferred-only job result status

#### Scenario: auto running task converges terminal and applies after restart

- **WHEN** an auto task is `running`, plugin restarts, and backend later reaches `succeeded`
- **THEN** plugin MUST converge UI/task snapshot to `succeeded`
- **AND** plugin MUST execute `applyResult` exactly once if recoverable context exists

### Requirement: missing-context legacy tasks MUST be handled conservatively

Plugin MUST converge status without speculative apply when legacy state lacks a
recoverable context payload.

#### Scenario: terminal succeeded without recoverable context

- **WHEN** a running task has no recoverable context and backend confirms `succeeded`
- **THEN** plugin MUST converge displayed state to `succeeded`
- **AND** plugin MUST NOT fabricate apply input or run `applyResult`
- **AND** plugin MUST emit explicit user-visible warning and diagnostic log with reason `missing-context`

### Requirement: managed local backend reconcile behavior MUST remain unchanged

Plugin MUST keep managed local backend excluded from startup full reconcile and
trigger its reconcile only from local runtime up flow.

#### Scenario: startup reconcile scope excludes managed local backend

- **WHEN** plugin startup performs backend task-ledger reconcile
- **THEN** managed local backend MUST remain excluded from startup full reconcile
- **AND** managed local backend MUST reconcile only on `local-runtime-up`

### Requirement: SkillRunner backend list and gating MUST reflect configured profile lifecycle

Dashboard and reconcile behavior MUST track configured backend profile lifecycle deterministically.

#### Scenario: removed backend does not persist as dashboard tab

- **WHEN** a backend profile is removed from backend registry
- **THEN** dashboard backend tabs MUST stop showing that backend immediately after refresh
- **AND** removed backend MUST NOT reappear via synthetic/history task row aggregation

#### Scenario: newly added backend appears as gated until proven reachable

- **WHEN** a new skillrunner backend profile is added to registry
- **THEN** dashboard MUST show its backend tab on next snapshot refresh
- **AND** the backend MUST be treated as unreachable/gated until health probe success
- **AND** after first successful probe it MAY become interactable

### Requirement: backend-scoped local state MUST be purged on profile deletion

Deleting a backend profile MUST remove backend-scoped local runtime traces.

#### Scenario: delete then re-add endpoint-equivalent backend does not revive old tasks

- **WHEN** backend profile `A` is deleted
- **THEN** plugin MUST purge backend-scoped reconcile contexts, request-ledger records, and task/history projections for `A`
- **AND** if user later adds a new backend profile pointing to the same endpoint
- **THEN** old tasks from deleted profile `A` MUST NOT reappear

### Requirement: local managed backend reachability handoff MUST be immediate after lease success

Managed local backend health view MUST not wait for next probe cycle once lease acquisition confirms runtime ownership.

#### Scenario: lease-acquired local backend is marked reachable immediately

- **WHEN** local managed backend completes lease acquire successfully
- **THEN** backend health state MUST be set to reachable immediately
- **AND** reconcile gating for that backend MUST be cleared without waiting a probe tick

