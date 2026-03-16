## Why

当前 SkillRunner interactive 任务在插件侧仍存在本地超时/终态判定，导致与后端状态机（尤其 `waiting_user`/`waiting_auth`）不一致，形成“双源状态”。

## What Changes

- 将 SkillRunner interactive 执行改为“两阶段”：
  - 队列阶段只负责提交并返回 `deferred`；
  - 终态由后台收敛器轮询后端状态机推进。
- 插件任务状态新增 `waiting_user`、`waiting_auth`，并以后端状态机为 SSOT。
- interactive 任务进入 waiting 时释放队列占位；终态成功由后台自动触发 `applyResult`。
- 持久化待收敛上下文，插件重启后继续收敛。
- Dashboard/Task 状态文案支持 waiting 态，抑制 interactive 等待阶段的误失败汇总。

## Impact

- 受影响代码：
  - `src/providers/skillrunner/client.ts`
  - `src/jobQueue/manager.ts`
  - `src/modules/skillRunnerTaskReconciler.ts`
- 受影响测试：
  - `test/core/31-transport-upload-fallback.test.ts`
  - `test/core/55-workflow-apply-seam-risk-regression.test.ts`
  - `test/core/70-skillrunner-task-reconciler.test.ts`
