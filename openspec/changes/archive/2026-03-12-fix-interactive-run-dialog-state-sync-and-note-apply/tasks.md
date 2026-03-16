## 1. OpenSpec

- [x] 1.1 新建 `fix-interactive-run-dialog-state-sync-and-note-apply` change 工件
- [x] 1.2 增加 `task-dashboard-skillrunner-observe` 与 `result-apply-handlers` delta specs

## 2. Run Dialog State Sync

- [x] 2.1 新增串行 `refreshRunState` 并在 reply/auth-import 成功后调用
- [x] 2.2 `chat_event` 控制事件触发防抖刷新
- [x] 2.3 非 waiting 状态清理 pending 交互卡片

## 3. Interactive Apply Reliability

- [x] 3.1 `literature-explainer` 改为 bundle-first 读取 `note_path`
- [x] 3.2 支持绝对路径映射到 bundle entry 后缀
- [x] 3.3 deferred apply 失败增加 5 次指数退避重试

## 4. Tests

- [x] 4.1 扩展 run dialog 控制事件刷新判定测试
- [x] 4.2 扩展 literature-explainer note_path 路径语义测试
- [x] 4.3 扩展 reconciler apply retry/retry-exhausted 测试
- [x] 4.4 运行 `npm run test:node:core`、`npm run test:node:workflow`、`npx tsc --noEmit`
