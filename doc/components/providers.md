# Providers 组件说明

## 目标

提供“后端协议适配层”，将 Workflow 构建出的 provider-specific request 执行为统一结果。

## 当前实现

- Provider 注册中心：`src/providers/registry.ts`
- 内置 Provider：
  - `skillrunner`：`src/providers/skillrunner/provider.ts`
  - `generic-http`：`src/providers/generic-http/provider.ts`
  - `pass-through`：`src/providers/pass-through/provider.ts`
- 选择逻辑：按 `requestKind + backend.type` 解析 Provider

## 输入

- `requestKind`：由 Workflow manifest/request 与 backend.type 共同决定
- `request`：由 `compileDeclarativeRequest` 或 `hooks.buildRequest` 产出
- `backend`：由 backend registry + workflow settings 解析出的 profile；对本地 provider（如 `pass-through`）可为 runtime 构建的虚拟 backend（`local://...`）
- `providerOptions`：运行时选项（持久化或 run-once 覆盖）

## 输出

统一返回 `ProviderExecutionResult`：

- `status: "succeeded"`
- `requestId: string`
- `fetchType: "bundle" | "result"`
- `bundleBytes?`
- `resultJson?`
- `responseJson?`

## Runtime 选项能力

- Provider 可声明可调选项 schema（如 skillrunner 的 `engine/model/no_cache`）
- Provider 可返回动态枚举（如 `model` 随 `engine` 变化）
- Provider 负责对 runtime options 做 normalize

## generic-http 语义（当前）

- 支持 request kind：
  - `generic-http.request.v1`（单请求）
  - `generic-http.steps.v1`（多步请求流水线）
- `generic-http.steps.v1` 能力：
  - 按声明顺序执行 `steps`
  - 支持变量提取与插值（`extract` + `{var}`）
  - 支持轮询语义（`repeat_until` + `poll.interval_ms/timeout_ms`）
  - 支持失败条件（`fail_when`）
  - 支持二进制上传/下载（`binary_from` / `response_type=bytes`）
- headers 合并优先级：
  - backend defaults headers
  - backend bearer auth（`Authorization: Bearer <token>`）
  - step/request headers（同名覆盖前者）
- 终态返回：
  - 最后一步为 bytes -> `fetchType="bundle"`
  - 否则 -> `fetchType="result"`

## pass-through 语义

- 固定 request kind：`pass-through.run.v1`
- 不发起网络请求，直接返回统一 `ProviderExecutionResult`
- `fetchType` 固定为 `result`
- `resultJson` 始终包含：
  - `selectionContext`（完整选择上下文）
  - `parameter`（workflow 参数）
  - `requestMeta`（`targetParentID/taskName/sourceAttachmentPaths`）

## 失败语义

- `requestKind` 与 `backend.type` 不匹配：Provider 必须抛错（拒绝执行）
- payload `kind` 不符合 Provider 合同：Provider 必须抛错
- 上述错误会由 workflow 执行层汇总为失败条目并反馈到任务汇总消息

## 边界

- Provider 不做业务落库（由 Workflow `applyResult` + handlers 负责）
- Provider 不直接操作 UI
- Provider 不依赖 workflow 私有逻辑（只消费 request payload）

## 备注

`transport` 目录当前未启用。网络执行逻辑目前在 Provider 内部实现（例如 skillrunner client）。

## 测试点（TDD）

- registry 选择逻辑
- runtime options schema 与动态枚举
- provider 执行成功/失败路径
- provider 与 backend type 不匹配时的错误行为
