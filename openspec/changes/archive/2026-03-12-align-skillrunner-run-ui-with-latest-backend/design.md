## Context

当前 Dashboard 的 SkillRunner backend Run 表格来自本地 runtime/history 合并。  
该数据源策略本次保持不变，避免“半本地半后端”混合渲染。

Run Dialog 已有独立窗口、SSE + history 补偿、reply/cancel 基础能力，但未覆盖 E2E 最新交互模式。

## Goals / Non-Goals

**Goals**

- 在本地 Run 表格中新增 `engine` 列并持久化回放。
- Run Dialog 状态区展示 `engine/model`，隐藏 `loading` 行。
- Run Dialog 对齐 E2E 最新核心交互：thinking 气泡、running 卡、waiting 卡片与 auth import。

**Non-Goals**

- 不把 `/v1/management/runs` 作为 Run 表格主数据源。
- 不在本次复刻 timeline/protocol/files 等高级面板。

## Architecture

### 1) 本地任务模型扩展（engine）

- 在 workflow 执行入队阶段，将 `providerOptions.engine` 写入 job meta。
- `WorkflowTaskRecord` / history record 增加可选 `engine` 字段。
- Dashboard SkillRunner backend 表格显示 `engine` 列；`model` 不进入该表。

### 2) Run Dialog 状态与会话模型升级

- Run session 新增 `engine`、`model` 字段（从 `getRun` 同步）。
- snapshot 新增 `engine/model` 展示字段；删除 `loading` 行输出。
- 对话消息模型保持结构化（`seq/role/text`），并在前端按 thinking 模型聚合渲染。

### 3) waiting_user / waiting_auth 卡片渲染

- 使用 `pending` payload 渲染交互卡片：
  - `waiting_user`：根据 `kind/options/ui_hints` 渲染按钮组或文本回复。
  - `waiting_auth`：根据 `phase` 与 `ui_hints` 渲染 method selection / challenge 卡。
- 支持 auth import：
  - 前端收集文件并通过 bridge 提交；
  - host 调用 `/v1/jobs/{request_id}/interaction/auth/import`；
  - 完成后刷新 status/history 并继续 SSE 会话。

### 4) Bridge 与 client 扩展

- run-dialog bridge 新增提交动作：
  - structured `reply-run`（支持 interaction/auth 两种 mode）；
  - `auth-import-run`（携带文件清单与 provider 信息）。
- management client 新增 auth import 调用与错误透传。

## Risks / Trade-offs

- `pending` payload 结构随后端演进：通过 `ui_hints` 与宽松字段读取提升兼容性。
- auth import 需要文件序列化跨窗口传递：采用最小必要字段（name/content）并限制仅在 waiting_auth 显示入口。
