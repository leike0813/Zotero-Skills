## MODIFIED Requirements

### Requirement: 系统必须提供任务 UI 的最小可观测能力
系统 MUST 以 Dashboard 形态提供任务可观测能力，而非仅单表视图。

#### Scenario: SkillRunner backend run table includes local engine column
- **WHEN** 用户进入 SkillRunner backend 的 run 列表页
- **THEN** 系统 MUST 在表格中展示本地任务记录的 `engine` 列
- **AND** `engine` 值 MUST 来自本地 runtime/history 任务模型
- **AND** 系统 MUST NOT 因该列改造引入后端 runs 列表作为主数据源
