## MODIFIED Requirements

### Requirement: 系统必须提供任务 UI 的最小可观测能力
系统 MUST 以 Dashboard 形态提供任务可观测能力，而非仅单表视图。

#### Scenario: 打开 Dashboard 默认显示摘要与运行中任务
- **WHEN** 用户打开任务面板
- **THEN** 系统 MUST 展示 Summary（总任务、运行中、成功、失败、取消）
- **AND** 系统 MUST 展示当前运行中任务列表

#### Scenario: Dashboard 按 backend 分组导航
- **WHEN** 运行历史包含多个 backend profile
- **THEN** 系统 MUST 在侧边栏按 backend 分组展示入口
- **AND** 点击 backend 后 MUST 进入对应 backend 详情视图

#### Scenario: Pass-through provider 不参与 Dashboard
- **WHEN** 任务来源 provider 为 pass-through
- **THEN** 系统 MUST NOT 在 Dashboard 中展示该任务
- **AND** 该任务 MUST NOT 纳入 Dashboard 计数
