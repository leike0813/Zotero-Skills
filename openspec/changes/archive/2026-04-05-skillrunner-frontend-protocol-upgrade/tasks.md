## 1. Spec

- [x] 1.1 补 proposal / design / tasks
- [x] 1.2 补 `workflow-settings-single-source-submit-flow` delta spec
- [x] 1.3 补 `task-dashboard-skillrunner-observe` delta spec
- [x] 1.4 新增 `skillrunner-provider-request-contract` delta spec

## 2. Provider And Settings Upgrade

- [x] 2.1 先更新 tests：settings/model catalog/provider 执行链路改为 `provider_id`
- [x] 2.2 将 SkillRunner runtime option schema、settings descriptor、dialog 和执行上下文统一到 `provider_id`
- [x] 2.3 `/v1/jobs` create payload 改为发送 `engine + provider_id + model`
- [x] 2.4 保留旧 `model_provider` / `provider/model` 的读取兼容，并在回写时升级到新形态
- [x] 2.5 将 provider-scoped engine 判定与 model cache/catalog 逻辑泛化到 `qwen`、`claude`、`opencode` 等所有暴露 `provider_id/provider + model` 的引擎
- [x] 2.6 扩展 SkillRunner model cache/catalog 以保存并暴露 `supported_effort`
- [x] 2.7 将 settings UI 与执行上下文升级为 `engine -> provider_id -> model -> effort`
- [x] 2.8 `/v1/jobs` create payload 显式发送 `effort`，并兼容读取旧 `provider/model@effort` / `model@effort`
- [x] 2.9 单 provider 引擎内部收口 canonical provider，UI 隐藏 provider 但保留 `provider_id + model + effort` 内部执行态

## 3. Waiting Auth Upgrade

- [x] 3.1 先更新 tests：run dialog bubble model 从 `authorization_code` 升级到 `auth_code_or_url`
- [x] 3.2 更新 pending auth normalization、输入框显示规则与 auth submission payload
- [x] 3.3 为 management client 增加 `GET /v1/jobs/{request_id}/auth/session`
- [x] 3.4 更新 run dialog 在 `waiting_auth` 阶段同时观察 `interaction/pending` 与 `auth/session`

## 4. Validation

- [x] 4.1 运行 settings/provider/run-dialog/management client 定向 mocha 测试
- [x] 4.2 运行 `openspec validate skillrunner-frontend-protocol-upgrade --strict`
- [x] 4.3 运行 `npx tsc --noEmit`

## 5. Waiting Auth Recovery Window

- [x] 5.1 补 `task-dashboard-skillrunner-observe` delta spec，明确 `waiting_auth` 退出后必须重建 `events/history -> events SSE`
- [x] 5.2 先补 tests：run dialog host 增加 `waiting_auth` 退出检测与状态通道重建语义回归
- [x] 5.3 在 run dialog host 中增加 `waiting_auth` 观察循环，并在退出时显式重建 session sync
- [x] 5.4 运行定向 mocha、`openspec validate skillrunner-frontend-protocol-upgrade --strict` 与 `npx tsc --noEmit`
