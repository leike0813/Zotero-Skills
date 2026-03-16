## Why

当前 SkillRunner Run 对话窗口仍使用单块文本渲染聊天内容，可读性与 E2E 客户端存在明显差距。  
需要将消息区升级为气泡渲染，以便用户在运行观察和交互过程中更快区分角色与消息边界。

## What Changes

- 将 Run Dialog 消息模型从纯文本数组升级为结构化消息（`seq/ts/role/text`）。
- 将 `run-dialog` 前端从单 `pre` 文本块改为消息气泡列表渲染。
- 增加 role 本地化文案（Agent/User/System），用于气泡标题显示。
- 保持现有 `open-run` 独立窗口、`reply/cancel` 动作、SSE/history 生命周期与终态判定不变。

## Capabilities

### Modified Capabilities

- `task-dashboard-skillrunner-observe`
- `task-runtime-ui`

## Impact

- 受影响模块：
  - `src/modules/skillRunnerRunDialog.ts`
  - `addon/content/dashboard/run-dialog.{js,css}`
  - `addon/locale/{en-US,zh-CN}/addon.ftl`
- 新增测试：
  - `test/core/65-skillrunner-run-dialog-bubble-model.test.ts`
