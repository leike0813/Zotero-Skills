## Why

Zotero-Skills 已经有围绕 workflow/SkillRunner 的执行入口，但 ACP 一期实现仍然停留在“可打开聊天壳层”的程度，缺少最基础的会话可观测性和交互闭环。用户无法确认 `npx opencode-ai@latest acp` 是否可执行、ACP 是否完成 initialize、session 是否已建立、prompt 是否真的在运行，也无法处理认证、权限确认、mode/model 切换等基础交互。

为了让 OpenCode ACP 真正达到“一期跑通”的标准，需要把这条链路升级为可观测、可交互、可诊断的 Sidebar MVP。

## What Changes

- 将内置 OpenCode ACP backend 保持为与 `reference/vscode-acp` 一致的 `npx opencode-ai@latest acp`。
- 扩展 ACP runtime，使其暴露 command check、spawn、initialize、session create、prompt、permission、auth、stderr、exit 等生命周期诊断信息。
- 修复 Zotero sidebar iframe 与宿主之间的动作桥接，改用 injected bridge 作为主通路，避免按钮点击无反应。
- 修复 Windows 下 `npx opencode-ai@latest acp` 的启动方式，使用 `cmd.exe /d /s /c ...` 兼容 npm shim。
- 将 ACP session manager 从“文本消息收集器”升级为结构化会话投影层，支持 thought、tool call、plan、usage、session metadata、mode/model、pending permission 等状态。
- 将 ACP live session 的 `sessionCwd` 与插件私有 `workspaceDir/runtimeDir` 分离，避免把存储目录误当成 agent 工作目录。
- 将 ACP 侧边栏页面升级为真正可用的聊天 MVP，支持状态观测、mode/model 选择、认证、权限确认、diagnostics 抽屉、新建会话、重连、取消和基础 transcript 渲染。
- 修订 OpenSpec 规格，使一期验收标准明确围绕“可观测跑通”而不是“存在最小页面”。

## Capabilities

### Modified Capabilities
- `acp-opencode-global-chat`: OpenCode ACP 全局聊天现在要求 `npx` 启动模型、会话投影、诊断可见性和基础交互控制。

## Impact

- Affected code: ACP runtime modules、sidebar UI、dashboard home entry、backend defaults、localization、OpenSpec artifacts。
- Dependencies: ACP 客户端协议、JSON-RPC 连接和 NDJSON framing 由仓库内自持实现提供，不再依赖外部 ACP SDK 运行时。
- Systems: `npx opencode-ai@latest acp` 命令链、ACP stdio transport、右侧边栏 host、插件本地 transcript/state 存储。
