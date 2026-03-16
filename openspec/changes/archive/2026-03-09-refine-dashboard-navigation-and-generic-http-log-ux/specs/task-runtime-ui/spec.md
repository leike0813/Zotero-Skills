## ADDED Requirements

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

