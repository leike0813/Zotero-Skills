## Overview

这次升级只处理插件前端的 run dialog / run workspace 聊天观察层，不改 SkillRunner 后端协议，也不把消息语义继续散落在浏览器脚本里临时猜测。核心思路是：

1. 宿主侧把 canonical chat replay 所需字段完整传到浏览器端
2. 共享 chat core 维护 mode-independent canonical timeline
3. `plain / bubble` 只做纯投影视图切换，不重新组织历史
4. Markdown / LaTeX 渲染作为 run dialog 本地静态资源能力接入

## Decisions

### 1. `assistant_message` 作为独立语义进入插件前端

- `RunDialogMessageKind` 扩展为：
  - `assistant_process`
  - `assistant_message`
  - `assistant_final`
  - 既有交互/编排 kind
- `assistant_message` 不再被当成 reasoning
- 宿主快照必须把 `attempt`、`correlation.message_id`、`correlation.replaces_message_id` 一并传给浏览器端

### 2. 双视图共享同一份 canonical timeline

- `chat_thinking_core.js` 内部只维护一份 source events / canonical atoms
- `plain` 和 `bubble` 的差异只体现在投影：
  - `plain`：`assistant_message` 直接显示为聊天正文，真正过程事件进轻量 process drawer
  - `bubble`：`assistant_message` 与 `assistant_process` 一起进入 thinking drawer，`assistant_final` 单独显示
- 切换 mode 只调用 `setDisplayMode()` 并重新投影，不依赖消息到达时的当前 mode

### 3. final 去重使用显式收敛关系优先

- 当出现 `assistant_final`：
  1. 优先删除 `replaces_message_id` 指向的 intermediate
  2. 否则删除同 `message_id` 的 intermediate
  3. 最后才允许按标准化文本兜底
- 去重范围限定在同一 `attempt`
- 为兼容旧链路，宿主侧显示消息构建仍允许删除同 `message_id` 的 `assistant_process`，但 browser-side canonical 投影只把真正的 intermediate 作为 final 的直接收敛目标

### 4. 视图模式只在当前 dialog 会话内生效

- 默认 mode 为 `plain`
- `bubble` 作为用户可切换的备用视图
- 这次不新增 prefs、localStorage 或 per-request 持久化链路
- 关闭窗口后下次重新回到 `plain`

### 5. Markdown / LaTeX 使用本地 vendor 资源

- run dialog 不复用当前项目其它模块里的 `marked` 渲染方案
- 直接引入本地静态 vendor：
  - `markdown-it`
  - `katex`
  - `markdown-it-texmath`
  - Katex fonts/CSS
- Markdown 配置固定为：
  - `html: false`
  - `breaks: true`
  - `delimiters: "dollars"`
- 两种视图共享同一渲染器；渲染失败回退到安全纯文本 HTML 转义

### 6. 共享聊天脚本必须具备缓存兼容保护

- `run-dialog.html` 对 `chat_thinking_core.js` 增加 cache-busting query
- `run-dialog.js` 通过 `createCompatibleThinkingChatModel(initialMode)` 包装 core：
  - 缺失 `createThinkingChatModel` 时降级为空
  - 只在对象支持 `setDisplayMode` 时调用
  - 若缺少 `getDisplayMode` 则提供默认 `plain/bubble` 兼容返回，避免旧缓存对象导致页面初始化失败

## Risks / Trade-offs

- Markdown/KaTeX vendor 资源会让 dashboard 静态资产体积上升，但这是换取本地可用性和不依赖 CDN 的必要成本
- plain 模式会改变默认视觉呈现；通过保留 bubble 模式按钮提供回退路径
- 宿主侧与浏览器侧会同时存在一层 dedupe，但职责不同：
  - 宿主侧负责兼容旧消息流和快照稳定性
  - 浏览器侧负责最终消息视图投影

## Validation

- `test/core/65-skillrunner-run-dialog-bubble-model.test.ts`
- `test/core/71-skillrunner-run-dialog-ui-e2e-alignment.test.ts`
- `test/core/84-skillrunner-chat-thinking-core.test.ts`
- `openspec validate skillrunner-chat-message-views-upgrade --strict`
- `npx tsc --noEmit`
