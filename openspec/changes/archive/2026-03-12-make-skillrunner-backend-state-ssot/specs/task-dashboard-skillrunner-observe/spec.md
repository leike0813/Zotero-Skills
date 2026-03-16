## ADDED Requirements

### Requirement: SkillRunner task status in dashboard SHALL use backend state machine as SSOT
Dashboard 中 SkillRunner 任务状态 SHALL 由后端状态机单源驱动，插件侧不再并行推断终态。

#### Scenario: waiting states are first-class task states
- **WHEN** backend reports `waiting_user` or `waiting_auth`
- **THEN** dashboard rows MUST render corresponding waiting status labels
- **AND** these tasks MUST remain active (non-terminal)

#### Scenario: deferred tasks survive restart and continue reconciliation
- **WHEN** plugin restarts with persisted deferred SkillRunner tasks
- **THEN** plugin MUST restore and continue backend reconciliation
- **AND** terminal success MUST still execute `applyResult` in background
