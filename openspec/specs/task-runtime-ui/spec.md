# task-runtime-ui Specification

## Purpose
TBD - created by archiving change m2-baseline. Update Purpose after archive.
## Requirements
### Requirement: 系统必须维护任务运行态模型
系统 MUST 维护任务在运行期的状态（排队、执行、完成、失败），并提供稳定标识用于查询与展示。

#### Scenario: 任务状态更新
- **WHEN** workflow 输入单元状态变化
- **THEN** 系统更新对应任务状态并保持键稳定

### Requirement: 系统必须提供任务 UI 的最小可观测能力
系统 MUST 以 Dashboard 形态提供任务可观测能力，而非仅单表视图。

#### Scenario: SkillRunner backend run table includes local engine column
- **WHEN** 用户进入 SkillRunner backend 的 run 列表页
- **THEN** 系统 MUST 在表格中展示本地任务记录的 `engine` 列
- **AND** `engine` 值 MUST 来自本地 runtime/history 任务模型
- **AND** 系统 MUST NOT 因该列改造引入后端 runs 列表作为主数据源

### Requirement: Dashboard MUST provide main-window toolbar shortcut with project logo
系统 MUST 在 Zotero 主窗口顶部工具栏提供 Dashboard 快捷入口，并使用项目图标。

#### Scenario: open dashboard from toolbar button
- **WHEN** 用户点击工具栏中的 Dashboard 图标按钮
- **THEN** 系统 MUST 打开 Dashboard 窗口
- **AND** 按钮卸载时 MUST 被清理，避免重复挂载

### Requirement: Dashboard sidebar MUST separate Home and Backend groups
系统 MUST 在 Dashboard 侧栏中提供 `Dashboard Home` 与 `Backends` 两个分组，并以视觉分隔线区分。

#### Scenario: render sidebar tabs
- **WHEN** Dashboard 渲染侧栏 tab
- **THEN** Home MUST 显示在独立分组
- **AND** Backend tabs MUST 显示在后端分组
- **AND** 两个分组之间 MUST 可见分隔符

### Requirement: Backend tab with no tasks MUST render backend-empty table state
系统 MUST 在“已选 backend 且无任务”时渲染该 backend 的空表态，而不是“请选择 backend”提示。

#### Scenario: selected backend has no rows
- **WHEN** 用户已进入某 backend tab 且该 backend 无历史/运行任务
- **THEN** 页面 MUST 显示空表格
- **AND** 文案 MUST 指示“当前 backend 无任务”

### Requirement: Run Dialog chat viewport MUST preserve manual scroll position
系统 MUST 在 Run Dialog 聊天区中仅在用户位于底部附近时自动跟随新消息，避免阅读旧消息时被强制跳转。

#### Scenario: auto-follow only near bottom
- **WHEN** 新 snapshot 到达且聊天区已有滚动位置
- **THEN** 若用户位于底部附近，系统 MUST 自动滚动到底部
- **AND** 若用户不在底部附近，系统 MUST 保持当前滚动位置不变

