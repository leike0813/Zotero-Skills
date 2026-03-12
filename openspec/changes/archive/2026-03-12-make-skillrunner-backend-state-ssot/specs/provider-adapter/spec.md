## ADDED Requirements

### Requirement: SkillRunner interactive execution SHALL defer terminal ownership to backend state machine
SkillRunner interactive 执行 SHALL 将终态裁决权交给后端状态机，插件侧仅负责同步与收敛。

#### Scenario: interactive request returns deferred after submit
- **WHEN** `skillrunner.job.v1` carries `runtime_options.execution_mode=interactive`
- **THEN** provider SHALL return `status=deferred` with `requestId` and non-terminal backend status
- **AND** plugin SHALL NOT mark job failed by local polling timeout during waiting states

#### Scenario: backend terminal status drives final outcome
- **WHEN** deferred task is reconciled to backend terminal `succeeded|failed|canceled`
- **THEN** plugin task state SHALL match backend terminal state
- **AND** only `succeeded` MAY trigger `applyResult`
