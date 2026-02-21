## Why

Skill-Runner 协议已支持 `POST /v1/jobs` mixed input（`input` + `parameter` + upload file），  
但插件侧 `skillrunner.job.v1` provider/client 仍主要按 `parameter + upload_files` 执行，形成协议能力不一致。

该不一致会阻塞依赖 inline input 的 workflow（例如 `tag-regulator`）落地。  
因此需要独立 change 先补齐 provider 透传能力，再由业务 workflow 复用。

## What Changes

- 扩展插件侧 `SkillRunnerJobRequestV1`，支持可选 inline `input` 载荷。
- 更新 skillrunner provider/client，在调用 `/v1/jobs` 时透传 `input` 与 `parameter`。
- 更新 request contract 校验，保持 `input` 可选且向后兼容旧请求。
- 补充 workflow manifest schema 描述：明确 `skillrunner.job.v1` 下 `request.input` 可承载 inline 字段并与 `request.input.upload` 并存。
- 补充 Node/Zotero 回归测试，覆盖“有 input / 无 input”两类路径。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `provider-adapter`: `skillrunner.job.v1` 支持 inline `input` 透传到 Skill-Runner `/v1/jobs`。
- `workflow-manifest-authoring-schema`: 明确 `request.input` mixed-input（inline + upload）声明的 schema 契约边界。

## Impact

- 仅影响 provider 协议适配层，不引入业务 workflow 行为变化。
- 为后续 `tag-regulator` 等 mixed-input workflow 提供通用基础能力。
