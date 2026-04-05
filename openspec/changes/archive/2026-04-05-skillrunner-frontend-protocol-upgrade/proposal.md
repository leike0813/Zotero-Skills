## Why

`artifact/frontend_upgrade_guide_2026-04-04.md` 以及 Skill-Runner 后续 `normalize-provider-model-effort-contract` 变更定义了两组已经对前端形成实质 breaking/recommended change 的 SkillRunner 协议升级：

- provider-aware engine 的模型选择与 run 创建应显式使用 `engine + provider_id + model + effort`
- `waiting_auth` 已将 `authorization_code` 统一升级为 `auth_code_or_url`，并引入 `accepts_chat_input` / `input_kind` 的输入框显示语义

但插件当前前端仍存在旧协议残留：

- workflow settings / provider 执行链路内部仍以 `model_provider` 为主，并且 `opencode` 执行态还会收敛回 `provider/model`
- model cache / catalog 还没有显式保存 `supported_effort`，也未统一覆盖单 provider 与多 provider 引擎的 canonical `provider_id + model + effort` 语义
- model cache / catalog 仍带有 `opencode` 特判，无法稳定覆盖后续新增的 provider-scoped engines（如 `qwen`、`claude`）
- run dialog 的 auth 相关测试与部分显示语义仍锁在 `authorization_code`
- management client 尚未提供 `GET /v1/jobs/{request_id}/auth/session`，run dialog 也无法在 `waiting_auth` 阶段同时观察 pending 与 auth session

这会导致前端与最新 SkillRunner 协议不一致，尤其在 qwen oauth_proxy 等自动推进 challenge 下，容易错误显示输入框或依赖伪输入。

## What Changes

- 新增 change `skillrunner-frontend-protocol-upgrade`
- 升级 SkillRunner 前端配置链路，统一内部字段为 `provider_id`
- 所有多 provider 引擎强制显式 `provider_id`，单 provider 引擎在前端内部收口 canonical `provider_id`
- model cache / catalog 显式保存并暴露 `supported_effort`
- `/v1/jobs` create payload 优先发送 `engine + provider_id + model + effort`
- 旧 `model_provider` 与 `model="provider/model"` / `model="provider/model@effort"` / `model="model@effort"` 仅保留读取兼容，后续写回统一升级到新形态
- run dialog / pending normalization / auth submission 全面升级到 `auth_code_or_url`
- 新增 `auth/session` management client 能力，并在 `waiting_auth` 阶段同步观察 `interaction/pending` 与 `auth/session`

## Capabilities

### Modified Capabilities

- `workflow-settings-single-source-submit-flow`
  - SkillRunner settings/submit 流程升级到显式 `provider_id + model + effort`
- `task-dashboard-skillrunner-observe`
  - `waiting_auth` 渲染、提交和观察逻辑升级到最新协议

### New Capabilities

- `skillrunner-provider-request-contract`
  - 定义 SkillRunner provider-aware engine 前端请求、`supported_effort` 暴露与兼容迁移契约

## Impact

- 更新 SkillRunner provider model catalog / runtime option schema / request create payload
- 更新 workflow settings descriptor、dialog、persisted normalizer 与执行上下文
- 更新 run dialog pending auth normalization、auth 提交 payload 与管理客户端
- 新增 `supported_effort` / `effort` 规范化测试、`auth/session` 观察测试、`provider_id` 规范化测试、`auth_code_or_url` bubble model 测试
