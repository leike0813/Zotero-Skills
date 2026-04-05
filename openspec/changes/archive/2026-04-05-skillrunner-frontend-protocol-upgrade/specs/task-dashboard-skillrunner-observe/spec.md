## ADDED Requirements

### Requirement: Dashboard MUST provide SkillRunner run observation and interaction view
系统 MUST 在 Dashboard 中提供 SkillRunner backend 的 run 观察页，支持对话流查看与交互操作。

#### Scenario: waiting_auth input visibility follows accepts_chat_input contract
- **WHEN** run 进入 `waiting_auth`
- **AND** pending auth payload has `accepts_chat_input=true` and non-empty `input_kind`
- **THEN** 系统 MUST 显示 auth 输入框
- **AND** auth 提交 MUST 使用 `submission.kind = input_kind` 或默认 `auth_code_or_url`

#### Scenario: waiting_auth auto-poll challenge hides input composer
- **WHEN** run 进入 `waiting_auth`
- **AND** pending auth payload has `accepts_chat_input=false` and empty `input_kind`
- **THEN** 系统 MUST 隐藏 auth 输入框
- **AND** 系统 MUST 继续展示 `auth_url` / `user_code`
- **AND** 系统 MUST 继续观察会话而不是要求伪输入

#### Scenario: waiting_auth observes pending and auth session together
- **WHEN** run 处于 `waiting_auth`
- **THEN** 前端 MUST 同时观察 `interaction/pending` 与 `auth/session`
- **AND** `interaction/pending` 继续作为交互卡片 SSOT
- **AND** `auth/session` 作为底层鉴权状态补充诊断

#### Scenario: waiting_auth exit restarts the events state channel
- **WHEN** run 处于 `waiting_auth`
- **AND** 前端观察到 `interaction/pending` 或 `auth/session` 已表明鉴权等待退出
- **THEN** 前端 MUST 主动重建该 request 的状态通道
- **AND** 重建目标 MUST 是 `events/history -> events SSE`
- **AND** 前端 MUST NOT 直接用 jobs API 轮询去改写 `queued/running` 非终态
