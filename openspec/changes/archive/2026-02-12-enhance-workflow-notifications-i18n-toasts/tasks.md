## 1. OpenSpec 文档与契约固化

- [x] 1.1 完成 `proposal.md`，明确 i18n + Toast + 模板示例清理目标
- [x] 1.2 完成 `design.md`，确认触发级/Job级提醒时机与实现边界
- [x] 1.3 完成 capability 规格：`workflow-execution-notifications`

## 2. 执行消息多语言化（TDD）

- [x] 2.1 先编写测试：总结消息支持可注入 formatter 且保持默认英文兼容
- [x] 2.2 修改 `src/modules/workflowExecuteMessage.ts`，支持本地化 formatter
- [x] 2.3 更新 `addon/locale/en-US/addon.ftl` 与 `addon/locale/zh-CN/addon.ftl` 新增执行提示文案键

## 3. 触发级 / Job级 Toast（TDD）

- [x] 3.1 先编写测试：一次触发开始时发送 1 条 Toast
- [x] 3.2 先编写测试：每个 job 结束时发送 1 条 Toast（成功/失败）
- [x] 3.3 修改 `src/modules/workflowExecute.ts` 接入 Toast 与本地化消息

## 4. 清理模板示例注册（TDD）

- [x] 4.1 先编写测试：执行 workflow 时不再出现模板示例快捷键提示
- [x] 4.2 修改 `src/hooks.ts`，移除模板示例注册链路
- [x] 4.3 回归测试：Workflow 菜单与执行主链路不受影响

## 5. 集成验证

- [x] 5.1 执行 `npm run build`
- [x] 5.2 执行 `npm run test:node:full`
