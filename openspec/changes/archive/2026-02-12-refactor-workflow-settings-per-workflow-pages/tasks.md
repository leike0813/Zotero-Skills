## 1. 设置入口改造（TDD）

- [x] 1.1 先编写测试：右键菜单 `Workflow Settings` 展示 workflow 二级列表并可按项触发 `openWorkflowSettings(workflowId)`
- [x] 1.2 先编写测试：首选项页 `Workflow Settings` 按钮弹出 workflow 二级列表并可进入对应 workflow 设置页
- [x] 1.3 修改 `src/modules/workflowMenu.ts`：将单项 `Workflow Settings...` 改为子菜单（每 workflow 一项）
- [x] 1.4 修改首选项入口（`src/modules/preferenceScript.ts` 及相关 UI）：实现与右键一致的 workflow 二级选择

## 2. 设置对话框重构为单 workflow 页面（TDD）

- [x] 2.1 先编写测试：`openWorkflowSettingsDialog({ workflowId })` 只渲染目标 workflow，不再出现 workflow 下拉
- [x] 2.2 修改 `src/hooks.ts` 与调用链：`openWorkflowSettings` 事件支持传入 `workflowId`
- [x] 2.3 重构 `src/modules/workflowSettingsDialog.ts`：移除 `zs-workflow-settings-workflow` 控件，改为单 workflow 渲染
- [x] 2.4 更新本地化文案（`addon/locale/**/addon.ftl`）与 UI 文本，反映新入口语义

## 3. Run Once 默认同步 Persistent（TDD）

- [x] 3.1 先编写测试：打开设置页时 Run Once 字段默认值等于当前 Persistent 值
- [x] 3.2 先编写测试：保存 Persistent 后再次打开设置页，Run Once 默认值更新为新 Persistent 值
- [x] 3.3 先编写测试：重新打开设置页不会继续沿用旧 Run Once 覆盖值
- [x] 3.4 修改 `src/modules/workflowSettingsDialog.ts`：Run Once 初始化改为基于 Persistent 快照
- [x] 3.5 视需要修改 `src/modules/workflowSettings.ts`：打开设置页时清理该 workflow 待消费 Run Once override，确保显示与执行一致

## 4. 回归验证与文档

- [x] 4.1 更新 `doc/components/workflows.md`（设置入口与 Run Once 默认语义）
- [x] 4.2 执行 `npm run build`
- [x] 4.3 执行 `npm run test:node:full`
