## 1. Toolbar Shortcut

- [x] 1.1 新增 Dashboard toolbar 按钮模块并接入主窗口生命周期
- [x] 1.2 按钮图标使用项目 logo，触发 `openDashboard`
- [x] 1.3 窗口卸载和插件关闭时清理按钮

## 2. Generic HTTP Logs UX

- [x] 2.1 扩展 snapshot：增加显式日志绑定任务与日志条目详情字段
- [x] 2.2 新增 `select-log-task` / `select-log-entry` action 路由
- [x] 2.3 日志过滤改为 requestId/jobId/workflowId 分层约束，避免混流

## 3. Dashboard Frontend

- [x] 3.1 侧栏增加 Home/Backends 分组与分隔线
- [x] 3.2 Generic HTTP 页面改为任务表 + 日志表 + 详情抽屉
- [x] 3.3 统一 actions 按钮尺寸与样式
- [x] 3.4 backend 无任务时显示空表与 backend 专属 empty 文案

## 4. Localization & Verification

- [x] 4.1 新增/更新中英文 locale 文案
- [x] 4.2 运行 `npm run test:node:ui`
- [x] 4.3 运行 `npm run test:node:core`
- [x] 4.4 运行 `npx tsc --noEmit`
