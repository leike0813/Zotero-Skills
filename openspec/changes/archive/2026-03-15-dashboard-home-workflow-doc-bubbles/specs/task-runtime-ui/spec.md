## ADDED Requirements

### Requirement: Dashboard home MUST provide workflow bubbles above task summary
系统 MUST 在 Dashboard 首页任务统计区上方渲染 workflow 气泡区，并为每个已注册 workflow 提供说明与设置入口。

#### Scenario: render compact workflow bubbles on home page
- **WHEN** 用户打开 Dashboard 首页
- **THEN** 系统 MUST 在任务统计区上方显示 workflow 气泡区
- **AND** 每个气泡 MUST 显示 workflow label
- **AND** 每个气泡 MUST 提供“说明”和“设置”两个按钮
- **AND** 气泡布局 MUST 水平排列并在空间不足时换行
- **AND** 气泡标题与按钮行 MUST 保持单行显示（不换行）

#### Scenario: disable settings button for non-configurable workflow
- **WHEN** 某 workflow 无可配置项
- **THEN** 该 workflow 气泡中的“设置”按钮 MUST 为禁用状态

### Requirement: Dashboard home MUST support embedded workflow README doc subview
系统 MUST 支持从首页 workflow 气泡进入 README 说明子页，并保持左侧 tab 结构不变。

#### Scenario: open workflow doc subview in home main area
- **WHEN** 用户点击 workflow 气泡中的“说明”按钮
- **THEN** 系统 MUST 在右侧主区显示该 workflow 的 README 渲染内容
- **AND** `selectedTabKey` MUST 保持为 `home`
- **AND** 页面 MUST 提供“回到 Dashboard”按钮返回首页主视图

#### Scenario: fallback when README is missing
- **WHEN** 目标 workflow 根目录不存在 `README.md`
- **THEN** 系统 MUST 显示本地化的“README 缺失”提示文本

### Requirement: Dashboard home MUST route workflow settings from bubbles
系统 MUST 支持从首页 workflow 气泡直接跳转到 workflow 设置页并定位目标 workflow。

#### Scenario: open workflow options from home bubble
- **WHEN** 用户点击 workflow 气泡中的“设置”按钮
- **THEN** 系统 MUST 切换到 `workflow-options` tab
- **AND** 系统 MUST 选中对应 workflow 的设置子页
