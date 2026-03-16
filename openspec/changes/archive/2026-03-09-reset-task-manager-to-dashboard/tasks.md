## 1. Provider / Queue Progress Chain

- [x] 1.1 为 provider 执行合同增加 `onProgress` 回调
- [x] 1.2 SkillRunner create 成功后发送 `request-created` progress 事件
- [x] 1.3 JobQueue 增加 progress 通道并支持运行中元数据增量更新
- [x] 1.4 runSeam 将 progress.requestId 写回 `job.meta.requestId` 并触发任务更新

## 2. Dashboard Browser Host

- [x] 2.1 重构 `taskManagerDialog` 为 browser-hosted 本地 Web 面板宿主
- [x] 2.2 实现 host bridge 协议（init/snapshot/action）
- [x] 2.3 保留 SkillRunner observer（SSE+history、reply/cancel）并通过 snapshot 暴露
- [x] 2.4 backend 页面使用 running+history 合并数据源，保证 running 任务即时可见

## 3. Local Web UI

- [x] 3.1 新增 `addon/content/dashboard/index.html`
- [x] 3.2 新增样式系统 `styles.css`（card/table/badge/layout token）
- [x] 3.3 新增 `app.js`（整页 tab 切换、Home、backend 表格、操作按钮）

## 4. Snapshot Model

- [x] 4.1 新增 `taskDashboardSnapshot` 纯模型模块
- [x] 4.2 backend 归一化（配置+history+active）
- [x] 4.3 tabKey 归一化与 running/history 行合并

## 5. Tests & Validation

- [x] 5.1 新增 progress 事件单测（SkillRunner client）
- [x] 5.2 新增 JobQueue progress 写回 requestId 单测
- [x] 5.3 新增 Dashboard snapshot 模型单测
- [x] 5.4 执行回归：`npm run test:node:core`
- [x] 5.5 执行回归：`npm run test:node:ui`
- [x] 5.6 执行回归：`npm run test:node:workflow`
- [x] 5.7 执行类型检查：`npx tsc --noEmit`
