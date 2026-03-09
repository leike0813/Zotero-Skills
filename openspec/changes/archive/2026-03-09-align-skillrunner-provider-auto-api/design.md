## Context

当前插件 skillrunner provider 的执行链是：
- `POST /v1/jobs`
- `POST /v1/jobs/{request_id}/upload`
- `GET /v1/jobs/{request_id}` 轮询
- `GET /v1/jobs/{request_id}/result|bundle`

该流程本身仍与新版后端兼容，但实现细节存在偏差：
- 轮询只将 `succeeded/failed` 视为终态，遗漏 `canceled`；
- `skillrunner.job.v1` 的 `input` 合同仍限制为 object，而后端 `input` 允许任意 JSON。

## Goals / Non-Goals

**Goals:**

- 在 Auto 模式下保证 provider 轮询状态机与后端文档一致。
- 将 `input` 合同放宽为任意 JSON，避免请求校验层与后端契约不一致。
- 保持现有 workflows 行为与执行路径不变。

**Non-Goals:**

- 不实现 interactive 流程（`waiting_user`、`interaction/reply`、`auth session`）。
- 不迁移 execution API 到 `/v1/management/*`。
- 不改 workflow 业务 hooks 与 UI 交互。

## Decisions

### Decision 1: `canceled` 作为轮询终态失败

- 轮询遇到 `status=canceled` 立即失败，不再继续轮询。
- 错误文案包含 `request_id`、`status`、`error`（若有），用于稳定诊断。

### Decision 2: `input` 合同改为任意 JSON

- `SkillRunnerJobRequestV1.input` 从 object-only 改为 `unknown`。
- request contract 仅校验必填字段，不再拒绝 string/array 等合法 JSON。

### Decision 3: Auto-only 语义显式文档化

- 在 provider 文档中明确当前 provider 是 Auto 执行链实现，interactive 能力后续 change 处理。

## Risks / Trade-offs

- [Risk] 合同放宽后，错误输入更可能在后端才暴露。  
  -> Mitigation: 保持 `skill_id/upload_files` 等必需字段严格校验，并补充合同测试。

- [Risk] 轮询失败信息变更影响测试断言。  
  -> Mitigation: 统一错误文案结构并更新对应测试，避免脆弱字符串匹配。

