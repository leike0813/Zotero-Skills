## Overview

这次升级分两层：

1. SkillRunner provider/settings 提交链路统一到 `provider_id + model + effort`
2. SkillRunner run dialog 的 `waiting_auth` 观察与提交链路统一到 `auth_code_or_url + auth/session`

实现目标不是“后端兼容什么就跟着混用”，而是把插件前端本身收敛到唯一主协议，同时保留对旧持久化值的只读兼容与自动升级。

## Provider/Model Contract

### Decision 1: 插件内部命名统一使用 `provider_id`

- workflow settings schema、dialog、execution context、provider normalizer 全部使用 `provider_id`
- 旧 `model_provider` 仅作为读取兼容输入，不再作为内部 canonical 字段
- settings 保存、submit confirm 等回写点统一写 `provider_id`

### Decision 2: 多 provider 引擎必须显式 provider_id，单 provider 引擎内部收口 canonical provider

- `provider_id` 缺失时，不允许生成有效 model enum 或最终 submit payload
- UI 上必须形成 `engine -> provider_id -> model` 的显式联动
- 不再依赖把 provider 编码进 `model` 字符串来推断选择
- provider-aware / provider-scoped engine 的判定来自 model catalog 暴露的 `provider_id/provider + model` 元数据，而不是前端硬编码 `opencode`
- model cache 必须保留 `provider_id`，并在缺失时仅以 `provider` / legacy `id=provider/model` 作为兼容回填
- 单 provider 引擎（`codex`、`gemini`、`iflow`）前端不向用户暴露 provider 选择，但内部执行态和 create payload 仍收口到 canonical provider：
  - `codex -> openai`
  - `gemini -> google`
  - `iflow -> iflowcn`

### Decision 3: `/v1/jobs` create payload 使用显式四元组

SkillRunner create step payload 统一发送：

- `engine`
- `provider_id`
- `model`
- `effort`

不再把 `provider/model` 作为新的 canonical request 值。

### Decision 4: `supported_effort` 为 catalog 与 UI 的一等元数据

- model cache / bundled static catalog / backend-scoped cache 全部显式保存 `supported_effort`
- settings UI 固定为 `engine -> provider_id -> model -> effort`
- `effort` 永远可见
  - 支持 effort 的模型：显示 `default + supported_effort`
  - 不支持 effort 的模型：固定显示 `default`，且控件禁用
- `effort="" | null` 一律收口为 `"default"`

### Decision 5: legacy 数据只读兼容、写时升级

需要兼容两类旧值：

- persisted `model_provider`
- persisted `model="provider/model"`
- persisted `model="provider/model@effort"`
- persisted `model="model@effort"`

读取时允许恢复为新执行态；一旦 settings 被保存或重新确认，就写回：

- `provider_id`
- `model`
- `effort`

不再新写 `model_provider` 或 `provider/model`。

## Waiting Auth Contract

### Decision 6: `authorization_code` 全量升级为 `auth_code_or_url`

- pending auth challenge
- method selection available methods
- auth submission default kind
- bubble model 测试与 UI 文案

统一切换到 `auth_code_or_url`。

### Decision 7: 输入框显示只由 challenge 接受能力决定

当且仅当：

- `accepts_chat_input === true`
- `input_kind` 非空

前端才显示输入框并允许 auth submission。

如果：

- `accepts_chat_input === false`
- `input_kind` 为空

前端必须隐藏输入框，只展示 `auth_url` / `user_code` 并继续观察。

这条规则尤其用于 qwen oauth_proxy 自动推进场景，禁止伪输入。

### Decision 8: waiting_auth 同时观察 pending 与 auth session

- `interaction/pending` 继续作为聊天侧交互卡片 SSOT
- 新增 `auth/session` 读取能力，作为底层 auth session 状态补充

run dialog 在 `waiting_auth` 阶段同时轮询：

- `/interaction/pending`
- `/auth/session`

这样可以更稳地显示 engine/provider/auth session 诊断，并避免把自动推进 challenge 误判成需要输入。

### Decision 9: leaving waiting_auth MUST restart the events state channel

- `waiting_auth` 期间 `/events` 状态流会按既有契约断开，因此 run dialog 不能只做一次性 pending/auth 读取
- 当前选中会话在 `waiting_auth` 时必须启动轻量观察循环，持续读取：
  - `/interaction/pending`
  - `/auth/session`
  - `chat/history` 增量
- 一旦观察到鉴权等待已退出，前端 MUST 主动执行一次 `stopSessionSync -> ensureSkillRunnerSessionSync`
- 这次重建的目标是重新接上 `events/history -> events SSE` 状态通道，而不是依赖 `/chat` snapshot 改写状态
- run dialog 仍不得用 `/v1/jobs/{request_id}` 轮询去推测 `queued/running`，非终态 SSOT 继续保持为状态事件

## Testing Strategy

- 先更新 model/provider/effort settings 与 provider client 的定向测试
- 再更新 run dialog bubble model / management client / waiting_auth 观察测试
- 最后跑 OpenSpec validate 与 `npx tsc --noEmit`

本次不扩展到无关 dashboard 统计或非 SkillRunner provider。
