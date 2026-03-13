## 1. OpenSpec Artifacts

- [x] 1.1 完成 `upgrade-runtime-log-diagnostics-for-issue-and-agent-debugging` 的 proposal/design/specs/tasks
- [x] 1.2 更新并校验 `runtime-log-pipeline`、`log-viewer-window`、`log-retention-control`、`task-runtime-ui` delta spec

## 2. Runtime Log SSOT Upgrade

- [x] 2.1 扩展 `RuntimeLogEntry/RuntimeLogInput` 数据模型（上下文、transport、diagnostic 元信息）
- [x] 2.2 增加诊断模式开关与模式化写入策略（默认低噪声 + 诊断细粒度）
- [x] 2.3 实现 `RuntimeDiagnosticBundleV1` 构建器与 issue 摘要构建器
- [x] 2.4 实现平衡脱敏（秘钥强脱敏 + 文本截断与哈希 + 大 payload preview）

## 3. Instrumentation Chain

- [x] 3.1 补齐 provider/client/queue/reconciler 执行边界日志与关联 ID
- [x] 3.2 统一错误分类（network/timeout/auth/validation/provider/hook）与 cause 摘要
- [x] 3.3 在 Dashboard backend 日志区增加“跳转到诊断导出”入口并保持现有浏览行为

## 4. Log Viewer UI Upgrade

- [x] 4.1 增加诊断模式开关、`Copy Diagnostic Bundle JSON`、`Copy Issue Summary`
- [x] 4.2 增加预算命中与脱敏状态提示
- [x] 4.3 补齐新增文案 i18n（en-US / zh-CN）

## 5. Tests and Validation

- [x] 5.1 扩展 runtime log manager 单测（兼容、脱敏、预算、导出 schema）
- [x] 5.2 扩展 provider/client/reconciler 链路测试（关联链完整性与 incident 聚合）
- [x] 5.3 扩展 log viewer UI 测试（模式切换、导出内容、敏感值保护）
- [x] 5.4 运行 `npm run test:node:core`
- [x] 5.5 运行 `npm run test:node:workflow`
- [x] 5.6 运行 `npx tsc --noEmit`
- [x] 5.7 运行 `openspec validate --changes --strict`
