## Context

SkillRunner 后端已定义运行状态机（`queued/running/waiting_user/waiting_auth/succeeded/failed/canceled`）。插件此前将 provider 同步轮询结果直接映射为本地终态，interactive 模式下会在等待阶段触发本地超时失败。

## Decisions

- 仅对 SkillRunner interactive 请求启用 `deferred` 返回：
  - create/upload 后立即返回 request_id 与后端当前状态；
  - 不在 provider 同步链路内等待终态。
- 新增后台收敛器（插件侧）：
  - 轮询 `/v1/jobs/{request_id}` 作为唯一状态来源；
  - 状态变化同步到任务运行时与历史；
  - 终态成功后拉取 `result|bundle` 并执行 `applyResult`。
- 队列职责收敛：
  - `JobQueue` 负责提交阶段；
  - `waiting_*` 视为非终态，队列占位释放。
- 持久化收敛上下文到 prefs，重启后恢复并继续轮询。

## Risks / Trade-offs

- interactive 任务不再在 `executeWorkflowFromCurrentSelection` 同步完成，完成时机转为后台收敛。
- 后台收敛器需要在异常网络下重试，避免频繁 toast 干扰；仅在进入 waiting 态时提示一次。
