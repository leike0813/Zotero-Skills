## MODIFIED Requirements

### Requirement: Dashboard MUST provide SkillRunner run observation and interaction view
系统 MUST 在 Dashboard 中提供 SkillRunner backend 的 run 观察页，支持对话流查看与交互操作。

#### Scenario: Run dialog status panel includes engine and model
- **WHEN** 用户打开 SkillRunner Run Dialog
- **THEN** 状态区 MUST 显示 `engine` 与 `model`
- **AND** 状态区 MUST NOT 单独展示 `loading` 行字段

#### Scenario: run dialog renders thinking bubbles and running card
- **WHEN** run chat 流包含 `assistant_process` 事件且状态为 `running`
- **THEN** 系统 MUST 将过程事件渲染为可折叠 thinking 气泡
- **AND** 系统 MUST 显示 running 提示卡

#### Scenario: waiting_user renders interaction card by ui_hints
- **WHEN** run 进入 `waiting_user` 且 pending payload 提供 `ui_hints/options`
- **THEN** 系统 MUST 渲染交互卡片并按提示提供按钮或文本输入
- **AND** 用户提交后 MUST 调用 reply 接口并刷新会话状态

#### Scenario: waiting_auth renders auth card and supports import files
- **WHEN** run 进入 `waiting_auth` 且 pending payload 指示 `import_files`
- **THEN** 系统 MUST 渲染鉴权交互卡
- **AND** 系统 MUST 支持选择文件并调用 auth import 接口
- **AND** 成功后 MUST 刷新状态并继续观察会话
