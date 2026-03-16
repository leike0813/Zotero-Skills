## Why

现有 Dashboard 在导航、日志观测与交互一致性上仍有明显可用性问题：

- 缺少主窗口顶部快速入口；
- Generic HTTP 日志信息粒度不足、任务绑定不明确；
- 侧栏 Home 与 backend 组没有清晰视觉分隔；
- actions 按钮尺寸在多语言下不一致；
- 已选 backend 且无任务时提示文案不正确。

需要集中修复这些问题，避免继续在日常使用中造成误导和额外操作成本。

## What Changes

- 在 Zotero 顶部工具栏右侧增加 Dashboard 快捷按钮，并使用项目 logo。
- Dashboard 侧栏拆分为 `Dashboard Home` 与 `Backends` 两组，中间显示分隔线。
- Generic HTTP backend 页改为“任务表 + 运行日志表 + 日志详情抽屉”结构。
- 引入显式日志绑定任务状态（`selectedLogTaskId`）：仅展示当前绑定任务日志，不随新任务自动跳转。
- 新增 `select-log-task` action，前端主动切换日志绑定目标。
- 统一 actions 按钮尺寸，避免多语言文案造成布局抖动。
- backend 空数据态展示“空表 + backend 专属 empty 文案”，不再复用“请选择后端”提示。
- 同步补充中英文 locale 文案。

## Capabilities

### Modified Capabilities

- `task-runtime-ui`
- `runtime-log-pipeline`

## Impact

- 受影响模块：
  - `src/hooks.ts`
  - `src/modules/taskManagerDialog.ts`
  - `addon/content/dashboard/{app.js,styles.css}`
  - `addon/locale/{en-US,zh-CN}/addon.ftl`
- 新增模块：
  - `src/modules/dashboardToolbarButton.ts`

