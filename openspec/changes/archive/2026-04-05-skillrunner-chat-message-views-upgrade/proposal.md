## Why

`artifact/frontend_upgrade_guide_2026-04-05_message_views.md` 定义了 SkillRunner 前端新的聊天区合同：

- 非终态 agent 文本必须使用独立的 `assistant_message` 语义，而不是继续伪装成 reasoning
- 前端必须基于同一份 canonical timeline 支持 `plain / bubble` 双视图
- 最终消息去重优先级升级为 `replaces_message_id -> message_id -> exact text`
- 共享聊天脚本需要 cache-busting 和旧缓存对象兼容保护
- run dialog 需要支持本地 Markdown + KaTeX 渲染，而不是继续停留在纯文本模式

当前插件前端仍停留在旧实现：

- browser-side chat core 只认识 `assistant_process` 和 `assistant_final`
- `run-dialog.js` 自己拼装 thinking bubble，无法稳定支持双视图投影
- `snapshot.messages` 没有把 `attempt`、`message_id`、`replaces_message_id` 传到浏览器端
- run dialog 静态页没有视图切换、没有 cache-busting、没有 markdown/katex vendor 资源

这会让插件前端继续落后于已更新的 SkillRunner 聊天协议，也让后续消息视图与 dedupe 行为缺少可验证的规格合同。

## What Changes

- 新增 change `skillrunner-chat-message-views-upgrade`
- 升级 SkillRunner run dialog 的消息 kind、snapshot message payload 和 browser-side chat core
- 引入 mode-independent canonical timeline，支持默认 `plain` 和可切换的 `bubble`
- 使用 `replaces_message_id -> message_id -> exact text` 规则处理 intermediate/final 收敛
- 为 run dialog 接入本地 `markdown-it + katex + markdown-it-texmath` vendor 资源
- 为共享聊天脚本增加 cache-busting 与旧 API 兼容包装

## Capabilities

### Modified Capabilities

- `task-dashboard-skillrunner-observe`
  - 明确 run dialog 观察前端在聊天区必须消费 canonical chat replay，并支持消息视图切换合同

### New Capabilities

- `skillrunner-chat-message-projection`
  - 定义 `assistant_process / assistant_message / assistant_final` 的投影、去重、plain/bubble 视图与 Markdown/LaTeX 渲染合同

## Impact

- 更新 `skillRunnerRunDialog` 宿主侧消息投影与去重逻辑
- 重构 dashboard 共享 `chat_thinking_core.js` 与 `run-dialog.js`
- 调整 `run-dialog.html` / `run-dialog.css`，引入 view toggle、vendor 资源和 plain/bubble 样式
- 新增 chat core 语义测试，并更新 run dialog host / UI alignment 测试
