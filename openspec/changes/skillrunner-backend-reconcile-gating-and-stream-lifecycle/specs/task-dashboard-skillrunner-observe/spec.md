## MODIFIED Requirements

### Requirement: SkillRunner backend reconcile gating MUST be backend-scoped

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

### Requirement: SkillRunner stream lifecycle MUST be bounded by state and selection

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

Plugin MUST NOT locally drive non-terminal transitions.

#### Scenario: non-terminal writes remain events-only, terminal supports confirm override

- **WHEN** non-terminal snapshot (`queued/running/waiting_*`) is updated
- **THEN** update MUST come from events stream semantics
- **AND** reconciler/jobs probes MUST NOT rewrite non-terminal state
- **AND** terminal (`succeeded/failed/canceled`) MAY converge by jobs double-confirm when terminal event is absent

### Requirement: SkillRunner task-state persistence MUST use plugin-scope SQLite

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
