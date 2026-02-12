## ADDED Requirements

### Requirement: Workflow settings MUST be opened as a dedicated page per workflow
系统 MUST 为每个 workflow 提供独立设置页面。设置页面打开时，必须已经确定目标 workflow，页面内不得再通过下拉切换 workflow。

#### Scenario: Open settings for a specific workflow from context menu
- **WHEN** 用户在右键菜单中进入 `Workflow Settings` 子菜单并选择某个 workflow
- **THEN** 系统 MUST 打开该 workflow 的专属设置页面
- **AND** 页面 MUST 仅展示该 workflow 的 provider/profile/workflow 参数与 run-once 区域
- **AND** 页面 MUST NOT 出现 workflow 选择下拉控件

### Requirement: Workflow settings entry MUST provide second-level workflow list
系统 MUST 在设置入口中提供 workflow 二级列表，用于在打开设置页前先选择目标 workflow。

#### Scenario: Context menu exposes per-workflow settings entries
- **WHEN** 用户打开右键菜单的 `Workflow Settings`
- **THEN** 系统 MUST 展示已加载 workflows 的二级列表
- **AND** 每个子项 MUST 对应一个 workflow 的设置入口

#### Scenario: Preferences button follows the same second-level selection flow
- **WHEN** 用户在首选项页点击 `Workflow Settings` 按钮
- **THEN** 系统 MUST 先展示 workflow 二级列表
- **AND** 选择某项后 MUST 打开对应 workflow 的专属设置页面
