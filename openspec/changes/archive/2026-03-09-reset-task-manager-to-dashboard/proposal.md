## Why

当前 Dashboard 仍是 `ztoolkit.Dialog + 特权层 DOM 拼装` 形态，导致：

- 视觉和交互与 SkillRunner 管理 UI / E2E 客户端风格差距大；
- 导航不是完整整页 Tab（缺少独立 Home 入口）；
- 运行中任务可见性不足，SkillRunner 任务创建后无法立即进入对话页。

需要将 Task Manager 重置为“浏览器承载的本地 Web Dashboard”，统一任务观测体验。

## What Changes

- 将 `openTaskManagerDialog` 重构为“宿主 + 本地 Web 面板（`chrome://.../content/dashboard/index.html`）”，不再在 privileged 层直接拼 Dashboard DOM。
- 新增 host bridge（`postMessage`）协议：
  - Host -> Web：`dashboard:init`、`dashboard:snapshot`
  - Web -> Host：`dashboard:action`
- 页面信息架构调整为整页 Tab：
  - `Dashboard Home`（统计 + 当前运行任务表格）
  - 每个 backend 一个独立页面（表格列表 + 操作）
- 运行可见性修复：backend 视图改为“运行态任务 + 本地历史”合并数据源，running 任务立即出现。
- SkillRunner 执行链新增 create 阶段 progress 上报：
  - `/v1/jobs` 成功后立即发送 `request-created`
  - JobQueue 将 `requestId` 写入 `job.meta` 并触发任务更新
  - Dashboard 在 running 阶段即可提供“打开对话”入口
- 保留并复用 SkillRunner 详情能力：SSE 主通道 + history 补偿 + reply/cancel。
- Pass-through 继续不展示、不计数、不入历史。

## Capabilities

### New Capabilities

- `dashboard-browser-host-bridge`：本地 Web Dashboard 与 privileged host 的双向消息合同。
- `task-dashboard-live-running-visibility`：运行态与历史合并视图，running 任务即时可见。

### Modified Capabilities

- `task-runtime-ui`：从特权层 DOM 组装切换到 browser-hosted Web Dashboard。
- `provider-adapter` / `job-queue`：新增 provider progress -> job 元数据增量更新链路。

## Impact

- 受影响模块：
  - `src/modules/taskManagerDialog.ts`
  - `src/jobQueue/manager.ts`
  - `src/modules/workflowExecution/runSeam.ts`
  - `src/providers/types.ts`
  - `src/providers/registry.ts`
  - `src/providers/skillrunner/{provider.ts,client.ts}`
- 新增模块与资源：
  - `src/modules/taskDashboardSnapshot.ts`
  - `addon/content/dashboard/{index.html,styles.css,app.js}`
- 测试新增/更新：
  - progress 事件与 requestId 早可见链路
  - Dashboard 视图模型合并与 tab 归一化

