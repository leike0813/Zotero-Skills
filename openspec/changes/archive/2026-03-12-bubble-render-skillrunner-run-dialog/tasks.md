## 1. OpenSpec & Contracts

- [x] 1.1 新建 `bubble-render-skillrunner-run-dialog` change 工件（proposal/design/tasks/.openspec.yaml）
- [x] 1.2 为 `task-dashboard-skillrunner-observe` 增加 Run Dialog 聊天气泡渲染要求
- [x] 1.3 为 `task-runtime-ui` 增加 Run Dialog 消息区视觉一致性要求

## 2. Host Message Model

- [x] 2.1 将 Run Dialog snapshot 消息升级为结构化（`seq/ts/role/text`）
- [x] 2.2 history 与 SSE 路径统一使用 role 归一化逻辑（未知 role 回退 `system`）
- [x] 2.3 保持现有去重、截断、reply/cancel 与终态判定语义不变

## 3. Frontend Bubble Rendering

- [x] 3.1 `run-dialog.js` 改为逐条气泡 DOM 渲染并显示角色标题
- [x] 3.2 `run-dialog.css` 增加 assistant/user/system 气泡样式
- [x] 3.3 增加“仅接近底部时自动滚动”的跟随策略

## 4. Localization & Verification

- [x] 4.1 增加中英文 role 文案键（Agent/User/System）
- [x] 4.2 新增 core 测试覆盖 role 归一化与结构化消息转换
- [x] 4.3 运行 `npm run test:node:core`
- [x] 4.4 运行 `npm run test:node:ui`
- [x] 4.5 运行 `npx tsc --noEmit`
