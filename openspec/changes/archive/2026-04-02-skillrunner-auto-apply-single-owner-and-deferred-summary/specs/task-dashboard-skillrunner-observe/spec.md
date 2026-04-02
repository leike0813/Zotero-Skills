## ADDED Requirements

### Requirement: SkillRunner recoverable terminal apply MUST have a single owner

Plugin MUST ensure exactly one execution path owns terminal `applyResult` for
recoverable SkillRunner requests.

#### Scenario: foreground apply skips SkillRunner auto terminal success

- **WHEN** a SkillRunner `auto` job reaches foreground queue state `succeeded`
- **THEN** foreground apply MUST NOT call `applyResult`
- **AND** plugin MUST mark that request as reconciler-owned pending terminal work

#### Scenario: reconciler owns recoverable terminal apply for both modes

- **WHEN** a recoverable SkillRunner request reaches terminal `succeeded`
- **THEN** reconciler MUST be the only path allowed to execute `applyResult`
- **AND** this ownership rule MUST apply to both `auto` and `interactive`

### Requirement: SkillRunner auto completion summary MUST be deferred to reconciler convergence

Plugin MUST delay final workflow completion messaging for reconciler-owned
SkillRunner `auto` jobs until terminal convergence is complete.

#### Scenario: foreground completion does not emit final summary for pending auto jobs

- **WHEN** foreground execution ends with one or more SkillRunner `auto` jobs delegated to reconciler-owned terminal apply
- **THEN** plugin MUST NOT emit final workflow summary immediately
- **AND** plugin MUST defer completion messaging to a run-scoped tracker

#### Scenario: deferred summary is session-scoped only

- **WHEN** reconciler finishes all pending auto jobs for a tracked `runId` in the same plugin session
- **THEN** plugin MUST emit one final workflow summary and deferred job toasts
- **AND** if plugin restarts before completion, plugin MUST NOT replay that old deferred summary after restart
