# Providers 组件说明

## 目标

提供“后端协议适配层”，将 Workflow 构建出的 provider-specific request 执行为统一结果。

## 当前实现

- Provider 注册中心：`src/providers/registry.ts`
- 内置 Provider：
  - `skillrunner`：`src/providers/skillrunner/provider.ts`
  - `generic-http`：`src/providers/generic-http/provider.ts`
- 选择逻辑：按 `requestKind + backend.type` 解析 Provider

## 输入

- `requestKind`：由 Workflow manifest/request 与 backend.type 共同决定
- `request`：由 `compileDeclarativeRequest` 或 `hooks.buildRequest` 产出
- `backend`：由 backend registry + workflow settings 解析出的 profile
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
