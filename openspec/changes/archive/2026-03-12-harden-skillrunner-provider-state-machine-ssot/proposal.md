## Why

当前 SkillRunner 状态语义在插件内分散在 provider/client、queue、reconciler、apply 与 dashboard/run-dialog 多处，各模块独立维护终态/等待态/状态映射，存在持续漂移风险。近期 interactive 场景已出现“本地推断状态”与后端状态机不一致的问题，暴露了缺少统一状态机 SSOT 与不变量守护。

## What Changes

- 新增插件侧统一状态机模块，集中定义：
  - 状态集合与归一化
  - 终态/等待态判定
  - 合法迁移矩阵
  - 关键事件序不变量
- 全链路替换分散状态判断为统一状态机调用：
  - provider/client
  - job queue
  - deferred reconciler + apply
  - dashboard/run-dialog host snapshot 语义
- 引入运行时守护：
  - 状态未知或非法迁移、事件序违规时记录结构化诊断日志
  - 执行降级路径，不中断线上任务
- 保持对外接口不变（后端 API、reply/auth-import 协议不变）。

## Impact

- 受影响代码（核心）：
  - `src/modules/skillRunnerProviderStateMachine.ts`（新增）
  - `src/providers/skillrunner/client.ts`
  - `src/jobQueue/manager.ts`
  - `src/modules/skillRunnerTaskReconciler.ts`
  - `src/modules/workflowExecution/applySeam.ts`
  - `src/modules/taskManagerDialog.ts`
  - `src/modules/skillRunnerRunDialog.ts`
  - `addon/content/dashboard/app.js`
  - `addon/content/dashboard/run-dialog.js`
- 受影响测试（核心）：
  - 新增状态机合同测试
  - 扩展 queue/reconciler/apply/run-dialog 相关回归测试
