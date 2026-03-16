## MODIFIED Requirements

### Requirement: Provider 执行结果必须统一为标准模型
系统 MUST 将不同 Provider 的执行输出归一为统一结果结构，供 runtime 与 `applyResult` 消费。

#### Scenario: skillrunner execution mode passthrough keeps auto chain unchanged
- **WHEN** a skillrunner workflow declares `execution.skillrunner_mode`
- **THEN** provider request chain SHALL inject it as `runtime_options.execution_mode`
- **AND** execution transport SHALL remain `/v1/jobs -> upload -> poll -> result|bundle`
- **AND** existing `execution.mode` plugin semantics SHALL NOT be overridden

#### Scenario: skillrunner runtime options read model catalog from backend-backed cache
- **WHEN** provider resolves `engine/model` runtime option enums
- **THEN** system SHALL prefer backend-refreshed local cache by backend scope
- **AND** on missing cache SHALL fallback to bundled static catalog
