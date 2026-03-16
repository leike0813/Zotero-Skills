## ADDED Requirements

### Requirement: SkillRunner Run Dialog chat MUST render role-based bubbles
系统 MUST 将 SkillRunner Run Dialog 的聊天消息渲染为角色分层气泡，以提升对话可读性。

#### Scenario: render structured messages as bubbles
- **WHEN** Run Dialog 收到 snapshot 中的结构化 `messages` 列表
- **THEN** 系统 MUST 按消息逐条渲染气泡
- **AND** 每条气泡 MUST 显示角色标题与正文
- **AND** 正文 MUST 以纯文本方式渲染（不解释 HTML/Markdown）

#### Scenario: unknown role fallback
- **WHEN** 消息 `role` 缺失或不是 `assistant|user|system`
- **THEN** 系统 MUST 将该消息按 `system` 角色渲染

