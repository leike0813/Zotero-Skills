# task-dashboard-skillrunner-observe Specification

## Purpose

Define canonical SkillRunner observation behavior in plugin dashboard/run workspace:

- backend jobs semantics as SSOT
- backend-level reconcile gating
- bounded stream lifecycle
- observer-only non-terminal semantics

## Requirements

### Requirement: SkillRunner backend reachability gating MUST be backend-scoped

#### Scenario: probe cadence degrades on consecutive backend failures

- **WHEN** a skillrunner backend becomes unreachable
- **THEN** plugin MUST set backend reconcile flag to true only after two consecutive probe failures
- **AND** retry cadence MUST degrade as `5s -> 15s -> 60s`
- **AND** cadence MUST reset to `5s` after a successful health probe
- **AND** plugin MUST clear reconcile flag on first successful probe
- **AND** when a backend profile is deleted, plugin MUST remove it from probe queue immediately

#### Scenario: backend recovery clears gating and resumes eligible running connections

- **WHEN** backend health probe succeeds after flagged period
- **THEN** plugin MUST clear backend reconcile flag
- **AND** plugin MUST resume event stream connections only for eligible `snapshot=running` tasks on that backend

### Requirement: SkillRunner stream lifecycle MUST be bounded by state and session ownership

#### Scenario: chat stream is singleton-session owned

- **WHEN** selected run session changes or run workspace closes
- **THEN** previous chat stream MUST disconnect immediately
- **AND** only currently selected session MAY own active chat stream

#### Scenario: event stream is running-only

- **WHEN** request snapshot is not `running`
- **THEN** plugin MUST keep request event stream disconnected
- **AND** if snapshot transitions to `waiting_user` or `waiting_auth` or terminal, event stream MUST disconnect immediately

### Requirement: SkillRunner non-terminal state MUST remain observer-only

#### Scenario: non-terminal writes are events-only

- **WHEN** non-terminal snapshot (`queued/running/waiting_*`) changes
- **THEN** change MUST originate from jobs events semantics
- **AND** reconciler/jobs probes MUST NOT rewrite non-terminal states

#### Scenario: terminal may converge by jobs confirmation

- **WHEN** backend reaches terminal without terminal `state.changed` event
- **THEN** plugin MUST allow terminal convergence via jobs double-confirm
- **AND** converged terminal MUST propagate consistently to dashboard row, workspace tab, and run banner

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

#### Scenario: legacy prefs migrate once then retire

- **WHEN** plugin starts and legacy prefs task-state JSON exists
- **THEN** plugin MUST migrate the rows into plugin SQLite task tables once
- **AND** plugin MUST clear legacy prefs task-state keys after successful migration
- **AND** runtime task-state read/write MUST no longer use legacy prefs keys

#### Scenario: restart restore uses SQLite as runtime source

- **WHEN** plugin restarts
- **THEN** request ledger, reconcile contexts, active rows, and history rows MUST restore from SQLite tables
- **AND** dashboard home running and backend-tab task lists MUST read from the same active-row source of truth
