## MODIFIED Requirements

### Requirement: Runtime Log Pipeline SHALL Record Structured Entries In Memory
The system SHALL provide a centralized in-memory pipeline that records plugin runtime logs as structured entries with correlation context and diagnostic metadata.

#### Scenario: Append a normal workflow entry
- **WHEN** a workflow lifecycle event is emitted
- **THEN** the pipeline SHALL append one entry containing timestamp, level, scope, stage, message, and available context IDs (`backendId/backendType/providerId/workflowId/runId/jobId/requestId/interactionId`)

#### Scenario: Append a transport-aware entry
- **WHEN** provider/client/queue/reconciler emits network or transport boundary logs
- **THEN** the pipeline SHALL persist transport summary fields (`method/url/path/status/duration/retry/size/stepId`) when provided
- **AND** missing transport fields SHALL remain optional without rejecting the entry

### Requirement: Runtime Log Pipeline SHALL Instrument Trigger-Level and Job-Level Execution Boundaries
Runtime log 管道 MUST 为 Dashboard 与诊断导出提供可按 request/job/run 聚合的执行边界日志，覆盖全 provider 执行链路。

#### Scenario: 按 requestId 过滤日志
- **WHEN** Dashboard backend 详情页指定 `requestId`
- **THEN** 系统 SHALL 返回仅属于该 request 的日志条目

#### Scenario: 按 jobId/workflowId 组合过滤日志
- **WHEN** Dashboard backend 详情页指定 `jobId` 或 `workflowId`
- **THEN** 系统 SHALL 返回满足过滤条件的日志条目
- **AND** 过滤结果可用于 Generic HTTP backend 任务详情页展示

#### Scenario: Cross-provider chain instrumentation
- **WHEN** SkillRunner、generic-http、pass-through 任一 provider 执行成功或失败
- **THEN** 系统 MUST 记录可关联到 request/job 的边界日志（dispatch/transport/retry/terminal）

## ADDED Requirements

### Requirement: Runtime Log Pipeline SHALL Support Session Diagnostic Mode
The pipeline MUST expose a session-level diagnostic mode switch that controls logging granularity.

#### Scenario: Diagnostic mode disabled
- **WHEN** diagnostic mode is disabled
- **THEN** pipeline SHALL keep default low-noise policy (info/warn/error by default)
- **AND** debug-only transport details SHALL NOT be emitted unless explicitly enabled

#### Scenario: Diagnostic mode enabled
- **WHEN** diagnostic mode is enabled
- **THEN** pipeline SHALL allow fine-grained debug entries and transport diagnostics for provider/client/reconciler boundaries

### Requirement: Runtime Log Pipeline SHALL Normalize Error Classification and Cause Summary
The pipeline MUST classify runtime failures into stable categories and preserve structured cause summaries.

#### Scenario: Normalize categorized errors
- **WHEN** an error is captured in provider/client/hook/reconciler paths
- **THEN** the stored log details SHALL include normalized category (`network|timeout|auth|validation|provider|hook|unknown`)
- **AND** a sanitized cause summary SHALL be retained for triage

### Requirement: Runtime Log Pipeline SHALL Build RuntimeDiagnosticBundleV1
The pipeline MUST support exporting a machine-consumable diagnostic bundle from retained logs.

#### Scenario: Build diagnostic bundle with filters
- **WHEN** caller requests diagnostic export with filters and time window
- **THEN** system SHALL output `RuntimeDiagnosticBundleV1` JSON with `meta`, `filters`, `timeline`, `incidents`, and `entries`
- **AND** `timeline` SHALL be time-ordered and `incidents` SHALL summarize first-failure/retry/terminal chain per request/job context
