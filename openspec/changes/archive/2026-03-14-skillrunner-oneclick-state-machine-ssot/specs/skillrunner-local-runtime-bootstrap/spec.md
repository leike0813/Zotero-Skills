## ADDED Requirements

### Requirement: Bootstrap Capability SHALL Defer Runtime Action Semantics to State Machine SSOT
`skillrunner-local-runtime-bootstrap` MUST 将本地运行时动作语义委托给 `skillrunner-local-runtime-state-machine-ssot`，避免重复定义或冲突定义。

#### Scenario: Runtime action contract source
- **WHEN** bootstrap 入口触发 deploy/start/stop/uninstall 相关动作
- **THEN** 动作可用性、状态切换、监测收敛规则 SHALL 以 `skillrunner-local-runtime-state-machine-ssot` 为准

#### Scenario: No duplicated state rules in bootstrap spec
- **WHEN** 维护 bootstrap spec 的运行时行为描述
- **THEN** bootstrap spec SHALL 仅保留入口链路与能力边界
- **AND** SHALL NOT 复制状态机转移矩阵或按钮门禁细则
