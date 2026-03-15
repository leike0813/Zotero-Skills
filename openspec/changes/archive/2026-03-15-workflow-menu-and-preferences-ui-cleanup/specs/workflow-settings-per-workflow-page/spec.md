## ADDED Requirements

### Requirement: Workflow context menu MUST NOT provide workflow settings submenu entry
系统 MUST 不再从右键 workflow 菜单提供 `Workflow Settings` 二级菜单入口。

#### Scenario: Open workflow context menu
- **WHEN** 用户打开 workflow 右键菜单
- **THEN** 菜单 MUST NOT 出现 `Workflow Settings...` 项
- **AND** workflow 设置入口 MUST 由首选项/仪表盘路径提供

### Requirement: Preferences workflow section MUST route to workflow-options page
系统 MUST 保持首选项工作流区入口可路由到 Dashboard 的 `Workflow选项 / Workflow Options` 页。

#### Scenario: Open workflow options from preferences
- **WHEN** 用户在首选项工作流区点击 `Open Workflow Options`
- **THEN** 系统 MUST 打开 Dashboard
- **AND** MUST 将当前页面定位到 `Workflow选项 / Workflow Options` 顶层 tab
