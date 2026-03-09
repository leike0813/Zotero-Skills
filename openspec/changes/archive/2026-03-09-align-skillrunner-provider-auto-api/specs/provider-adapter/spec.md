## MODIFIED Requirements

### Requirement: 系统必须对 Provider Request Contract 做统一校验
系统 MUST 在 runtime/provider dispatch 过程中复用同一套 Provider Request Contract 校验规则，保证请求类型、后端类型和请求负载约束一致。

#### Scenario: skillrunner mixed-input payload accepts arbitrary JSON input
- **WHEN** `skillrunner.job.v1` payload carries optional `input` as string/array/object with existing `parameter`
- **THEN** contract validation SHALL accept payload as long as mandatory fields remain valid
- **AND** provider execution path SHALL forward both `input` and `parameter` to backend `/v1/jobs`

### Requirement: Provider 执行结果必须统一为标准模型
系统 MUST 将不同 Provider 的执行输出归一为统一结果结构，供 runtime 与 `applyResult` 消费。

#### Scenario: skillrunner Auto polling fails fast on terminal canceled
- **WHEN** skillrunner poll endpoint returns terminal `status=canceled`
- **THEN** provider SHALL stop polling immediately
- **AND** provider SHALL raise a deterministic error message containing `request_id` and terminal `status`
- **AND** provider SHALL NOT continue to `/result` or `/bundle` fetch

