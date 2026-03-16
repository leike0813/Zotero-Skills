## Why

SkillRunner 后端与 E2E 客户端最近升级后，插件侧 Dashboard/Run Dialog 存在三类对齐缺口：

- SkillRunner backend 的本地 Run 表格缺少 `engine` 信息；
- Run 详情状态区没有展示 `engine/model`，且仍显示 `loading` 字段；
- Run 对话窗口缺少 E2E 最新交互能力（thinking 过程气泡、`running` 提示卡、`waiting_user`/`waiting_auth` 的 `ui_hints` 卡片、auth import）。

同时，Dashboard Run 表格数据源已确定保持“纯本地”，不引入后端 runs 列表作为主数据源。

## What Changes

- 新增 change：`align-skillrunner-run-ui-with-latest-backend`。
- SkillRunner Run 表格仅新增本地 `engine` 列（不显示 `model`，不接后端 runs 列表）。
- Run Dialog 状态区新增 `engine + model`，移除 `loading` 行展示。
- Run Dialog 对齐 E2E 对话能力：
  - thinking 过程气泡（`assistant_process` 聚合、折叠展开）；
  - `running` 动态提示卡；
  - `waiting_user` / `waiting_auth` 卡片按 `ui_hints` 渲染；
  - 支持 `import_files` 鉴权文件导入并恢复状态流。
- 扩展 management client 与 run-dialog bridge，支持 auth import 与结构化交互动作。

## Capabilities

### Modified Capabilities

- `task-runtime-ui`
- `task-dashboard-skillrunner-observe`

## Impact

- 受影响模块：
  - `src/modules/taskRuntime.ts`
  - `src/modules/workflowExecution/runSeam.ts`
  - `src/modules/taskDashboardHistory.ts`
  - `src/modules/taskManagerDialog.ts`
  - `src/modules/skillRunnerRunDialog.ts`
  - `src/providers/skillrunner/managementClient.ts`
  - `addon/content/dashboard/run-dialog.{html,js,css}`
  - `addon/content/dashboard/app.js`
  - `addon/locale/{en-US,zh-CN}/addon.ftl`
- 受影响测试：
  - `test/core/42-task-runtime.test.ts`
  - `test/core/60-task-dashboard-history.test.ts`
  - `test/core/62-task-dashboard-snapshot.test.ts`
  - `test/core/61-skillrunner-management-client.test.ts`
  - `test/core/65-skillrunner-run-dialog-bubble-model.test.ts`
