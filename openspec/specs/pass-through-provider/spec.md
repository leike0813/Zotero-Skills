# pass-through-provider Specification

## Purpose
TBD - created by archiving change add-pass-through-provider. Update Purpose after archive.
## Requirements
### Requirement: 系统必须提供 pass-through provider
系统 MUST 提供 `pass-through` provider，用于在本地执行 workflow，而不依赖远端后端调用。

#### Scenario: 本地执行入口
- **WHEN** workflow 声明 `provider="pass-through"`
- **THEN** 系统走本地 provider 执行路径
- **AND** 不发起网络请求

### Requirement: pass-through 请求类型必须固定为 pass-through.run.v1
系统 MUST 使用固定 request kind `pass-through.run.v1`，避免协议漂移。

#### Scenario: 请求构建
- **WHEN** runtime/compiler 为 pass-through workflow 构建请求
- **THEN** 请求 kind 为 `pass-through.run.v1`

### Requirement: 系统必须始终注入完整 Selection Context
系统 MUST 在 `runResult.resultJson` 中注入完整 `selectionContext`，且不提供开关关闭该行为。

#### Scenario: applyResult 消费上下文
- **WHEN** pass-through workflow 进入 `applyResult`
- **THEN** hook 可从 `runResult.resultJson.selectionContext` 读取完整选择集

### Requirement: pass-through workflow 必须兼容最小声明模式
系统 MUST 允许 `provider=pass-through` 的 workflow 在不声明 `request` 与 `hooks.buildRequest` 时执行。

#### Scenario: 最小 workflow 清单
- **WHEN** workflow 仅声明 `hooks.applyResult`（可选 `filterInputs`）
- **THEN** runtime 仍能补全请求并执行

### Requirement: 系统必须保持与统一 ProviderExecutionResult 契约兼容
系统 MUST 让 pass-through provider 返回统一执行结果模型，供任务运行态与消息汇总复用。

#### Scenario: 执行结果归一
- **WHEN** pass-through provider 成功执行
- **THEN** 返回标准化结果（含 `status/requestId/fetchType/resultJson`）

### Requirement: pass-through Contract 校验必须与统一 Provider Contract 一致
系统 MUST 让 pass-through 在统一 provider-request contract 层中通过校验，且不引入对远端 backend 的额外硬依赖。

#### Scenario: pass-through 最小声明流通过统一 contract 校验
- **WHEN** pass-through workflow 以最小声明模式执行
- **THEN** contract 校验 SHALL 通过
- **AND** 不要求远端 backend profile

#### Scenario: 非法 pass-through request kind 被拒绝
- **WHEN** pass-through workflow 产生非 `pass-through.run.v1` 的请求类型
- **THEN** 系统 SHALL 返回标准化 contract 错误并终止当前输入单元
