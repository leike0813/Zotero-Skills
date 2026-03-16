## MODIFIED Requirements

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
