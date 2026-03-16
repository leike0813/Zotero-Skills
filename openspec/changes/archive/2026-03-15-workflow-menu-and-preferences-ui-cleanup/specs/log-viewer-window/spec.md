## ADDED Requirements

### Requirement: Log viewer entry MUST be exposed from preferences workflow section
系统 MUST 在首选项工作流区提供日志窗口入口。

#### Scenario: Open log viewer from preferences
- **WHEN** 用户在首选项工作流区点击 `Open Log Viewer`
- **THEN** 系统 MUST 打开日志窗口页面（Dashboard runtime-logs tab）

### Requirement: Workflow context menu MUST NOT expose log viewer entry
系统 MUST 不再从 workflow 右键菜单提供日志窗口入口。

#### Scenario: Open workflow context menu
- **WHEN** 用户打开 workflow 右键菜单
- **THEN** 菜单 MUST NOT 出现 `Open Logs...` 项
