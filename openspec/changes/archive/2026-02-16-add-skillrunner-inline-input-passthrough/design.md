## Context

参考 `reference/Skill-Runner/docs/api_reference.md`，`POST /v1/jobs` 支持：
- `input`：业务输入（含 inline 字段）
- `parameter`：配置参数
- `/upload`：file input（严格键匹配）

插件现状是 `skillrunner.job.v1` 主要围绕 `parameter` 与 `upload_files` 建模，  
导致 inline `input` 无法稳定透传到后端请求体，协议能力落后于 Skill-Runner。
另外，workflow 作者侧需要明确该能力在 manifest schema 中如何表达，避免“能透传但不会声明”的文档断层。

## Goals / Non-Goals

**Goals:**

- 让 `skillrunner.job.v1` 在插件侧支持可选 inline `input` 字段。
- 让 provider client 构造 `/v1/jobs` 请求时同时携带 `input` 与 `parameter`。
- 保持向后兼容：旧 workflow 不提供 `input` 时行为不变。
- 用回归测试锁定契约，防止后续回退。
- 在 change 内补齐 workflow schema 描述，明确 mixed-input 的 authoring 契约边界。

**Non-Goals:**

- 不实现新的业务 workflow。
- 不改动 Skill-Runner 后端 API 设计。
- 不改变 upload 文件输入机制（仍走 `/upload`）。

## Decisions

### Decision 1: `input` 设计为可选字段

- `SkillRunnerJobRequestV1` 增加 `input?: Record<string, unknown>`。
- request contract 校验仍以现有必需字段为准；`input` 非强制。

### Decision 2: provider/client 统一透传 mixed-input

- 在 provider 层保持请求语义透明转发。
- 在 client 创建 `/v1/jobs` body 时同时发送：
  - `input`（若存在）
  - `parameter`
  - 既有 engine/model/runtime_options

### Decision 3: 回归覆盖兼容性优先

- 增加“无 input 的旧请求”回归，确保无行为回归。
- 增加“有 input 的新请求”回归，确保字段确实到达后端请求体。

### Decision 4: workflow schema 只约束结构容器，不锁死 inline 业务字段

- workflow manifest schema 继续作为唯一结构契约来源（SSOT）。
- 对 `skillrunner.job.v1` 的 `request.input`：
  - 继续保留 `request.input.upload.files` 的结构化约束；
  - 允许同层承载 inline 业务字段（例如 `request.input.inline` 或其他键），以适配 Skill-Runner mixed-input 协议演进。
- 这样可以在不反复修改插件 schema 的前提下，保持 workflow 作者声明能力与后端协议同步。

## Risks / Trade-offs

- [Risk] 放宽 payload 结构可能引入弱类型输入  
  -> Mitigation: 仅新增可选字段，不放宽必需字段校验，并用测试约束序列化行为。

- [Risk] provider/client 变更影响既有 workflow 请求路径  
  -> Mitigation: 增加兼容回归，验证旧 workflow 请求体与执行路径不变。
