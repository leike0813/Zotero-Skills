## Why

interactive run 详情页在 `choose_one/confirm` 等非 `open_text` 交互后，插件侧会出现状态停留在 `waiting_user` 的问题，导致状态 badge 与提示卡片滞后。与此同时，`literature-explainer` 的 `note_path` 仍按本地文件路径读取，和当前后端 bundle 协议不一致，终态 `applyResult` 会漏执行。

## What Changes

- 对齐 E2E 的 run 状态刷新策略：
  - `reply-run` / `auth-import-run` 提交成功后主动执行 `getRun + getPending + chat/history catch-up` 刷新；
  - `chat_event` 中的 `interaction.reply.*` / `interaction.pending.*` / `auth.*` 触发防抖刷新；
  - 非 waiting 状态自动清理 pending 交互卡，避免 UI 分裂显示。
- 修复 `literature-explainer` 结果消费：
  - `note_path` 以 bundle entry 语义读取；
  - 支持绝对路径映射到 `artifacts|result|bundle` 后缀；
  - 路径无效时返回 `skipped=true` 与明确 reason。
- 增强 deferred reconciler：
  - 后端终态 `succeeded` 时若 `applyResult` 失败，执行 5 次指数退避自动重试；
  - 成功后清理上下文；超限记录 `deferred-apply-exhausted` 并清理。

## Impact

- 受影响代码：
  - `src/modules/skillRunnerRunDialog.ts`
  - `workflows/literature-explainer/hooks/applyResult.js`
  - `src/modules/skillRunnerTaskReconciler.ts`
- 受影响测试：
  - `test/core/65-skillrunner-run-dialog-bubble-model.test.ts`
  - `test/core/70-skillrunner-task-reconciler.test.ts`
  - `test/workflow-literature-explainer/21-workflow-literature-explainer.test.ts`
