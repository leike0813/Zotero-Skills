# task-dashboard-skillrunner-observe Specification

## Purpose
TBD - created by archiving change reset-task-manager-to-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Dashboard MUST provide SkillRunner run observation and interaction view
系统 MUST 在 Dashboard 中提供 SkillRunner backend 的 run 观察页，支持对话流查看与交互操作。

#### Scenario: SkillRunner run 详情支持 SSE 主通道 + history 补偿
- **WHEN** 用户打开某个 SkillRunner run 详情页
- **THEN** 系统 MUST 通过 `chat` SSE 订阅实时消息
- **AND** 断线或续传时 MUST 通过 `chat/history` 按 cursor 补偿并去重

#### Scenario: waiting_user 时支持 reply 与 cancel
- **WHEN** run 状态为 `waiting_user` 或用户主动取消运行
- **THEN** 系统 MUST 支持提交 reply
- **AND** 系统 MUST 支持 cancel 操作并展示最新状态

#### Scenario: 仅展示本前端发起的 SkillRunner runs
- **WHEN** 后端存在非本前端发起的 runs
- **THEN** Dashboard SkillRunner run 列表 MUST 仅展示本地历史中的 request_id

