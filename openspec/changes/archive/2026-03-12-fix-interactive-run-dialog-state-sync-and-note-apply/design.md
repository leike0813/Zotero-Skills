## Context

SkillRunner 后端状态机是 SSOT，但 Run Dialog 仅靠 SSE `snapshot` 推进状态，`chat_event` 提交确认场景缺少主动拉取，导致 pending 卡片与状态 badge 可能停留在 waiting。另一个问题是 `literature-explainer` 将 `note_path` 当成本地文件路径读取，偏离了 bundle 协议。

## Decisions

- Run Dialog 对齐 E2E 的“提交后刷新”策略：
  - 引入串行 `refreshRunState`，统一执行 `getRun`、`getPending`、`chat/history`、`pushSnapshot`；
  - `reply-run` / `auth-import-run` 成功后立即触发刷新；
  - 对交互控制类 `chat_event` 做防抖刷新，避免频繁请求。
- waiting 卡片清理规则显式化：
  - 当状态不再是 `waiting_user|waiting_auth` 时，强制清理 `pendingOwner/pendingInteraction/pendingAuth`，避免 stale 卡片。
- `note_path` 协议改为 bundle-first：
  - 优先从 bundle entry 读取 markdown；
  - 支持绝对路径映射成 bundle 后缀路径；
  - 路径不可读时以 `skipped` 返回，不抛异常破坏成功终态。
- deferred apply 可靠性增强：
  - 终态 `succeeded` 下 apply 失败使用指数退避重试（最多 5 次）；
  - 重试状态持久化，重启后可继续收敛；
  - 超过上限后记录 `deferred-apply-exhausted`，防止无限重试。

## Risks / Trade-offs

- 控制事件触发主动刷新会增加少量管理 API 调用；通过防抖和串行队列控制请求风暴。
- `note_path` 绝对路径映射采用后缀截取策略，若路径不含 `artifacts/result/bundle` 标记会按原值回退，可能仍被判定为 bundle 缺失并跳过。
