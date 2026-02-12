## Why

当前 Workflow 执行提示存在两个问题：一是总结弹窗文案硬编码英文，缺少多语言能力；二是缺少触发开始与单 job 完成的即时反馈，用户只能在整次执行结束后看到结果。  
此外，插件仍保留模板示例提醒（如“Example Shortcuts”），会干扰正式使用体验。

## What Changes

- 为 Workflow 执行提示补充多语言文案（至少 en-US / zh-CN）。
- 增加右下角自动消失的临时提醒（Toast）：
  - 一次触发开始时发送统一提醒；
  - 每个 job 完成后发送单独提醒（成功/失败）。
- 保留现有整次触发总结弹窗逻辑，并改为可本地化文案。
- 清理模板示例注册链路，移除启动期示例提醒框来源（含“Example Shortcuts”等模板示例行为）。

## Capabilities

### New Capabilities

- `workflow-execution-notifications`: 定义 Workflow 触发级与 job 级提示、总结弹窗的多语言与触发时机要求。

### Modified Capabilities

- （无）

## Impact

- `src/modules/workflowExecute.ts`：增加触发开始和 job 完成 Toast；统一接入本地化消息。
- `src/modules/workflowExecuteMessage.ts`：支持可本地化的消息格式化策略。
- `addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`：新增 workflow 执行提示相关文案键。
- `src/hooks.ts`：移除模板示例注册调用，避免启动期示例提醒。
- `test/zotero/24-workflow-execute-message.test.ts`、`test/zotero/37-pass-through-provider.test.ts` 及相关测试：补充/更新提醒行为与文案断言。
