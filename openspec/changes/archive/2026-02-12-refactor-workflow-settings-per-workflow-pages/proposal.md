## Why

当前 Workflow 设置页采用“单页 + workflow 下拉切换”的交互，配置切换成本高，也容易在 Persistent / Run Once 两套字段之间产生认知负担。随着 workflow 数量增加，需要将设置入口和设置页都重构为“按 workflow 独立管理”的形态，并统一 Run Once 的默认语义。

## What Changes

- 将 Workflow 设置从“统一页面 + workflow 下拉”重构为“每个 workflow 独立设置页面”。
- 右键菜单中 `Workflow Settings...` 改为二级菜单：按 workflow 列出独立设置入口。
- 首选项页中的 `Workflow Settings` 按钮改为与右键菜单一致：先弹出 workflow 二级列表，再进入对应设置页。
- 取消原设置页面中的 workflow 选择下拉控件。
- 统一 `Run Once` 默认行为：每次打开某个 workflow 设置页时，Run Once 字段都用当前已保存的 Persistent 设置初始化（不新增独立开关）。
- 调整相关测试与文档，覆盖新菜单结构、单 workflow 设置页、Run Once 初始化语义。

## Capabilities

### New Capabilities

- `workflow-settings-per-workflow-page`: 为每个 workflow 提供独立设置页面与独立入口，移除统一页面中的 workflow 下拉切换。
- `workflow-settings-run-once-default-sync`: 定义 Run Once 在每次打开设置页时默认与 Persistent 保持一致的初始化语义。

### Modified Capabilities

- None.

## Impact

- `src/modules/workflowMenu.ts`：重构 `Workflow Settings` 菜单入口为二级 workflow 列表。
- `src/modules/preferenceScript.ts` 与首选项相关 UI：将按钮入口改为 workflow 列表选择流程。
- `src/hooks.ts`：扩展 `openWorkflowSettings` 事件参数，支持按 workflow 打开。
- `src/modules/workflowSettingsDialog.ts`：改为单 workflow 页面，移除 workflow 下拉；Run Once 初始化逻辑改为基于 Persistent 快照。
- `src/modules/workflowSettings.ts`：必要时补充 Run Once 生命周期处理，保证“打开页面后的默认值”和“实际执行值”一致。
- `test/zotero/40-gui-preferences-menu-scan.test.ts`、`test/zotero/35-workflow-settings-execution.test.ts`（及新增对话框测试）：
  覆盖菜单结构与 Run Once 初始化回归。
- `doc/components/workflows.md`（及相关 UI 文档）：更新设置入口与行为说明。
