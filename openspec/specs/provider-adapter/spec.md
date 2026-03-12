# provider-adapter Specification

## Purpose
TBD - created by archiving change m2-baseline. Update Purpose after archive.
## Requirements
### Requirement: 系统必须按 requestKind 与 backend.type 解析 Provider
系统 MUST 基于 `requestKind + backend.type` 选择可执行 Provider，避免 workflow 与后端协议强耦合。

#### Scenario: Provider 解析成功
- **WHEN** 存在匹配当前请求类型与 backend 类型的 Provider
- **THEN** 系统使用该 Provider 执行请求

#### Scenario: Provider 解析失败
- **WHEN** 不存在匹配 Provider
- **THEN** 系统返回明确错误并终止当前输入单元执行

### Requirement: 系统必须对 Provider Request Contract 做统一校验
系统 MUST 在 runtime/provider dispatch 过程中复用同一套 Provider Request Contract 校验规则，保证请求类型、后端类型和请求负载约束一致。

#### Scenario: skillrunner mixed-input payload accepts arbitrary JSON input
- **WHEN** `skillrunner.job.v1` payload carries optional `input` as string/array/object with existing `parameter`
- **THEN** contract validation SHALL accept payload as long as mandatory fields remain valid
- **AND** provider execution path SHALL forward both `input` and `parameter` to backend `/v1/jobs`

### Requirement: Provider 执行结果必须统一为标准模型
系统 MUST 将不同 Provider 的执行输出归一为统一结果结构，供 runtime 与 `applyResult` 消费。

#### Scenario: skillrunner file-input mapping follows input-relative-path protocol
- **WHEN** request kind is `skillrunner.job.v1` and payload contains non-empty `upload_files`
- **THEN** provider contract SHALL require `input` to be object
- **AND** each `upload_files[].key` SHALL resolve to `input.<key>` relative path under uploads root
- **AND** upload zip entries SHALL use that resolved relative path instead of legacy key name

#### Scenario: inline-only skillrunner payload skips upload step
- **WHEN** request kind is `skillrunner.job.v1` and `upload_files` is missing or empty
- **THEN** execution chain SHALL skip `/upload`
- **AND** provider SHALL continue with `create -> poll -> result|bundle`

### Requirement: SkillRunner interactive execution SHALL defer terminal ownership to backend state machine
SkillRunner interactive 执行 SHALL 将终态裁决权交给后端状态机，插件侧仅负责同步与收敛。

#### Scenario: interactive request returns deferred after submit
- **WHEN** `skillrunner.job.v1` carries `runtime_options.execution_mode=interactive`
- **THEN** provider SHALL return `status=deferred` with `requestId` and non-terminal backend status
- **AND** plugin SHALL NOT mark job failed by local polling timeout during waiting states

#### Scenario: backend terminal status drives final outcome
- **WHEN** deferred task is reconciled to backend terminal `succeeded|failed|canceled`
- **THEN** plugin task state SHALL match backend terminal state
- **AND** only `succeeded` MAY trigger `applyResult`

### Requirement: SkillRunner provider chain SHALL consume a single plugin-side state machine SSOT
SkillRunner provider/client/reconciler 全链路 SHALL 复用同一个插件侧状态机语义，避免分散判定导致漂移。

#### Scenario: unknown backend status degrades to safe non-terminal state with diagnostics
- **WHEN** provider/client or reconciler receives an unknown status value from backend or runtime payload
- **THEN** plugin MUST normalize it to canonical safe non-terminal status (`running`)
- **AND** plugin MUST emit structured state-machine diagnostics (`ruleId`, `requestId`, `action=degraded`)

#### Scenario: illegal status transition is guarded without hard failure
- **WHEN** chain observes a transition outside the legal transition matrix
- **THEN** plugin MUST record a state-machine warning with transition context
- **AND** plugin MUST apply degradation path instead of throwing hard runtime error

#### Scenario: key event order invariants are enforced
- **WHEN** runtime event sequence violates invariant rules (`request-created`, `deferred`, `waiting-resumed`, `apply-succeeded once`)
- **THEN** plugin MUST emit state-machine diagnostics with violated `ruleId`
- **AND** plugin MUST continue execution with degraded behavior

