## ADDED Requirements

### Requirement: 系统必须按 requestKind 与 backend.type 解析 Provider
系统 MUST 基于 `requestKind + backend.type` 选择可执行 Provider，避免 workflow 与后端协议强耦合。

#### Scenario: Provider 解析成功
- **WHEN** 存在匹配当前请求类型与 backend 类型的 Provider
- **THEN** 系统使用该 Provider 执行请求

#### Scenario: Provider 解析失败
- **WHEN** 不存在匹配 Provider
- **THEN** 系统返回明确错误并终止当前输入单元执行

### Requirement: Provider 执行结果必须统一为标准模型
系统 MUST 将不同 Provider 的执行输出归一为统一结果结构，供 runtime 与 `applyResult` 消费。

#### Scenario: 成功执行
- **WHEN** Provider 完成执行
- **THEN** 返回统一的 `status/requestId/fetchType/result` 语义
