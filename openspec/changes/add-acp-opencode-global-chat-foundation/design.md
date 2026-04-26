## Context

ACP 一期的核心目标不是把 OpenCode 接成另一个 workflow backend，而是提供一个真正可用的全局持久 agent 入口。因此本轮设计围绕 Sidebar MVP 展开，重点是把 `npx opencode-ai@latest acp` 的生命周期、会话状态和失败原因暴露出来，并让用户能够直接处理 mode/model、认证和权限请求。

## Goals / Non-Goals

**Goals:**
- 用 `reference/vscode-acp` 同型的 `npx opencode-ai@latest acp` 启动 OpenCode ACP。
- 在 sidebar 中明确显示 command check、spawn、initialize、session create、prompt、error、stderr、exit 等状态。
- 修复 Zotero sidebar iframe 与宿主之间的动作通道，避免“页面能打开但动作发不出去”。
- 完整投影 ACP `session/update` 事件，至少覆盖 assistant message、thought、tool call、tool call update、plan、available commands、mode update、session info update、usage update。
- 提供 mode/model 切换、认证、权限确认、重连、新建会话、取消等基础交互闭环。
- 继续保持 ACP 位于 workflow 主链之外。

**Non-Goals:**
- 不做多 agent 列表和通用 ACP backend 编辑器。
- 不开放 fs / terminal client capability。
- 不做复杂 Zotero 数据注入和大规模上下文拼装。
- 不做远端 session 跨插件重启恢复。

## Decisions

### 1. OpenCode 固定走宿主机全局命令

内置 `acp-opencode` backend 统一使用：

- `command: "npx"`
- `args: ["opencode-ai@latest", "acp"]`

如果 `npx` 不在宿主机 `PATH` 中，ACP runtime 必须在 sidebar 中明确显示 prerequisite failure，而不是静默失败。

Windows 上的 `npx` 命令必须通过 `cmd.exe /d /s /c ...` 包装启动，以兼容 `npx.cmd` 这类 npm shim，而不是直接把裸命令交给 `spawn(..., { shell: false })`。

### 2. ACP adapter 负责协议能力隔离

ACP 协议常量、错误模型、JSON-RPC 连接和消息 framing 由仓库内自持模块提供。`acpConnectionAdapter.ts` 只依赖本地协议/连接层，并对上层暴露：

- `setMode`
- `setModel`
- `authenticate`
- diagnostics 事件订阅
- permission request 事件订阅

这样 session manager 和 sidebar 不直接依赖 ACP SDK 细节。

### 3. Session manager 负责结构化会话投影

`acpSessionManager` 持有唯一活动会话和 sidebar snapshot，负责：

- lifecycle 状态转换
- `SessionUpdate` 到结构化 transcript items 的投影
- mode/model/session metadata/current usage 的更新
- pending permission request 与 auth methods 的收敛
- diagnostics ring buffer
- 本地 transcript/state 持久化

此外 session manager 需要区分三类路径语义：

- `sessionCwd`: 真实传给 `npx opencode-ai@latest acp` 与 `session/new cwd` 的工作目录，默认取 `Zotero.DataDirectory`，回退到宿主 cwd
- `workspaceDir`: 插件私有 ACP 存储目录
- `runtimeDir`: ACP runtime/log/state 目录

### 4. Sidebar 只做单页 MVP

这一轮不扩展 Backend Manager ACP 卡片，也不做参考项目中的多面板结构。侧边栏单页需要覆盖：

- 顶部状态与 backend/session/command 信息
- mode/model picker
- auth / permission actions
- transcript
- diagnostics drawer
- composer 和基本控制按钮

Sidebar 模式下 ACP 页面动作统一走 injected bridge `__zsAcpSidebarBridge`，`postMessage` 只保留为兜底。这样 Zotero/XUL 宿主里的 iframe 可以可靠把 `ready/send/reconnect/cancel/...` 发回宿主。

### 5. Host context 继续最小化，但必须显式可见

每轮 prompt 仍只携带最小 host metadata：

- 当前 library 标识
- selection 是否为空
- 当前 item `id/key/title`

但 sidebar 必须把这次实际注入的 host context 摘要显示出来，避免上下文黑箱。

### 6. Diagnostics feedback loop 优先支持远程除错

由于 Zotero 内实测只能由用户执行，ACP sidebar 必须提供可复制的 JSON diagnostics bundle。bundle 包含 host runtime flags、backend command metadata、session cwd、workspace/runtime paths、last error、stderr tail、recent diagnostics、recent transcript items 和 host context。ACP adapter 和本地 JSON-RPC connection 需要记录 request/response/notification 的方向、方法、id、错误码，并保留错误 stack、stage、code/data/raw metadata。

## Risks / Trade-offs

- [`npx` 不可执行] → 在 transport 启动前做命令解析/探测，并把错误写入 diagnostics 与 prerequisite banner。
- [ACP update 类型增多后 sidebar 状态复杂] → 用结构化 snapshot 做单向投影，避免在 iframe 中推断协议状态。
- [permission/auth flow 阻塞 prompt] → session manager 显式持有 pending request/resolver，让 UI 有明确的 allow/deny 和 authenticate 入口。
- [Zotero runtime 与 Node 测试环境的 subprocess 能力不同] → transport 同时支持 Mozilla Subprocess 与 Node spawn，并统一返回 command label / stderr / close semantics。
- [Windows 宿主机全局命令是 `.cmd` shim] → transport 统一生成 launch plan，并在 Windows 上显式走 `cmd.exe /d /s /c`。
- [sidebar iframe action 通道在 Zotero 中失效] → ACP 复用 SkillRunner 已验证过的 injected bridge 模式，不再把 `postMessage` 当作唯一主通路。
