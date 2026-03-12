# task-dashboard-skillrunner-observe Specification

## Purpose
TBD - created by archiving change reset-task-manager-to-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Dashboard MUST provide SkillRunner run observation and interaction view
Dashboard 与 Run Dialog MUST 以后端快照为主，统一渲染 SkillRunner 交互态与运行态。

#### Scenario: interaction/auth control events trigger authoritative state refresh
- **WHEN** run dialog receives `interaction.reply.*` / `interaction.pending.*` / `auth.*` chat events
- **THEN** host MUST trigger a debounced state refresh (`getRun` + `getPending` + history catch-up)
- **AND** waiting cards and status badge MUST converge to backend latest state

#### Scenario: leaving waiting state clears pending cards immediately
- **WHEN** backend status becomes non-`waiting_user` and non-`waiting_auth`
- **THEN** host MUST clear pending interaction/auth snapshot fields
- **AND** prompt/auth cards MUST be hidden in next snapshot

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

### Requirement: SkillRunner task status in dashboard SHALL use backend state machine as SSOT
Dashboard 中 SkillRunner 任务状态 SHALL 由后端状态机单源驱动，插件侧不再并行推断终态。

#### Scenario: waiting states are first-class task states
- **WHEN** backend reports `waiting_user` or `waiting_auth`
- **THEN** dashboard rows MUST render corresponding waiting status labels
- **AND** these tasks MUST remain active (non-terminal)

#### Scenario: deferred tasks survive restart and continue reconciliation
- **WHEN** plugin restarts with persisted deferred SkillRunner tasks
- **THEN** plugin MUST restore and continue backend reconciliation
- **AND** terminal success MUST still execute `applyResult` in background

### Requirement: Dashboard and Run dialog SHALL render SkillRunner state semantics from host SSOT snapshot
Dashboard 与 Run Dialog SHALL 仅消费宿主快照中的状态语义字段，不再在前端复制独立状态机判定。

#### Scenario: terminal/waiting semantics are consumed from host snapshot
- **WHEN** dashboard or run-dialog frontend receives host snapshot payload
- **THEN** frontend MUST use host-provided state semantics fields for terminal/waiting behavior
- **AND** frontend MUST NOT maintain an independent terminal/waiting inference matrix

#### Scenario: waiting states remain non-terminal in UI control gating
- **WHEN** snapshot status is `waiting_user` or `waiting_auth`
- **THEN** UI controls and hints MUST follow waiting semantics from host fields
- **AND** task row/run dialog MUST NOT treat waiting as failure or completion

