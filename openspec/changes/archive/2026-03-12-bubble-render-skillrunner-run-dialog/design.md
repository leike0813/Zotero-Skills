## Context

Run Dialog 已经具备独立窗口 + SSE 主通道 + history 补偿 + reply/cancel 的完整链路。  
本次仅替换“消息区展示层”，不改变任务状态机和管理 API 调用路径。

## Goals / Non-Goals

**Goals**

- 将聊天消息渲染为角色分层气泡，提升可读性并对齐 SkillRunner E2E 客户端观感。
- 统一 history 与 SSE 的消息结构，避免前端字符串猜测角色。
- 保持纯文本安全渲染（`textContent` + `white-space: pre-wrap`），不引入富文本注入风险。

**Non-Goals**

- 不复刻 timeline/protocol/raw-ref 等高级面板。
- 不改 `open-run` 打开方式与窗口生命周期。
- 不改 management client 协议与 reply/cancel 行为。

## Architecture

### 1) Host 消息结构化

- 在 `skillRunnerRunDialog` 内新增 role 归一化与结构化消息转换函数：
  - 合法 role：`assistant|user|system`
  - 非法或缺失 role：回退 `system`
- history 和 SSE 均复用同一转换函数，保持去重规则（基于 `seq` 与 `lastSeq`）不变。
- snapshot 输出结构化 `messages`，供前端直接渲染气泡。

### 2) Run Dialog 前端渲染

- `run-dialog.js` 改为按消息列表构建 DOM 气泡：
  - 角色标题（本地化）
  - 正文（纯文本）
- 引入“接近底部才自动跟随”策略，避免用户查看旧消息时被强制拉回底部。

### 3) 样式与本地化

- `run-dialog.css` 增加气泡布局样式（assistant/user/system 三态）。
- 增加中英文 role 文案键，避免前端硬编码角色标题。

## Risks / Trade-offs

- 旧快照若没有 `role` 字段：
  - 前端统一回退 `system`，不会导致渲染崩溃。
- 仅展示角色和正文，调试信息减少：
  - 通过保留内部 `seq/ts/raw` 结构，为后续扩展元信息面板预留能力。
