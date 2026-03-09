## ADDED Requirements

### Requirement: Backend Manager MUST expose SkillRunner management-page entry
系统 MUST 在 Backend Manager 的 SkillRunner profile 行提供“进入管理页面”动作，用于直接打开对应后端的管理 UI。

#### Scenario: only SkillRunner rows expose management-page action
- **WHEN** Backend Manager 渲染各 provider 的 profile 行
- **THEN** `type=skillrunner` 的行 MUST 显示管理页入口动作
- **AND** 非 skillrunner 行 MUST NOT 显示该动作

#### Scenario: management entry resolves URL from current row state
- **WHEN** 用户点击 SkillRunner 行的管理页入口
- **THEN** 系统 SHALL 使用当前行实时 `baseUrl`（包括未保存编辑）构造 `${baseUrl}/ui`
- **AND** URL 解析失败时 MUST 阻断打开并返回可诊断错误
