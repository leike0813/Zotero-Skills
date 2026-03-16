## MODIFIED Requirements

### Requirement: SkillRunner interactive execution SHALL defer terminal ownership to backend state machine
SkillRunner interactive 执行 SHALL 将终态裁决权交给后端状态机，插件侧仅负责同步与收敛。

#### Scenario: managed local backend ensures runtime before dispatch
- **WHEN** provider dispatch targets managed local backend `skillrunner-local`
- **THEN** provider chain SHALL ensure local runtime is running before sending job create request
- **AND** ensure failure SHALL surface as provider error without mutating unrelated backend profiles

### Requirement: SkillRunner provider chain SHALL consume a single plugin-side state machine SSOT
SkillRunner provider/client/reconciler 全链路 SHALL 复用同一个插件侧状态机语义，避免分散判定导致漂移。

#### Scenario: non-managed skillrunner backend skips local runtime management
- **WHEN** provider dispatch targets a non-managed SkillRunner backend profile
- **THEN** provider chain SHALL NOT invoke local ctl/lease management
- **AND** request dispatch semantics SHALL remain unchanged from existing behavior
