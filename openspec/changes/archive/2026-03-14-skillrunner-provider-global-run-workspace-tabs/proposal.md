## Why

当前 SkillRunner 运行详情采用“按请求单独弹窗”模型，任务视图分散，跨 backend profile 切换成本高。  
需要收敛为全局唯一运行详情页，并在同一页面完成任务分组、切换与交互，降低操作分裂和状态漂移风险。

## What Changes

- 新增全局单例 SkillRunner 运行工作区（run workspace），统一承载“打开运行详情”入口。
- 工作区采用左右布局：左侧分组 tab 导航，右侧复用现有 run detail 交互布局。
- 左侧按 backend profile 分组；非终态任务直出，终态任务收纳到“已结束任务”子气泡。
- `openSkillRunnerRunDialog` 对外 API 名称保持不变，语义升级为“单例路由 + 定位任务”。
- 新增 run workspace 快照合同：`workspace.groups[]`、`workspace.selectedTaskKey`、`session`。
- 增补 i18n 文案：`已结束任务`、`等待 requestId`、分组/子气泡辅助文案（`zh-CN/en-US`）。

## Capabilities

### New Capabilities

- `skillrunner-provider-global-run-workspace-tabs`: 规范全局单例运行详情页、分组 tab 行为、路由与快照合同。

### Modified Capabilities

- `task-dashboard-skillrunner-observe`: “打开运行详情”入口收敛为 run workspace 单例路由。

## Impact

- 影响模块：`skillRunnerRunDialog`、`taskManagerDialog`、dashboard run-dialog 前端资源。
- 影响资源：`addon/content/dashboard/run-dialog.{html,css,js}`、`addon/locale/**/addon.ftl`。
- 影响测试：run-dialog 模型测试、run-dialog 前端对齐测试、单例路由与分组行为测试。
