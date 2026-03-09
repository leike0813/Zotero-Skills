# runtime-log-pipeline Specification

## Purpose
TBD - created by archiving change add-plugin-log-system. Update Purpose after archive.
## Requirements
### Requirement: Runtime Log Pipeline SHALL Record Structured Entries In Memory
The system SHALL provide a centralized in-memory pipeline that records plugin runtime logs as structured entries.

#### Scenario: Append a normal workflow entry
- **WHEN** a workflow lifecycle event is emitted
- **THEN** the pipeline SHALL append one entry containing timestamp, level, scope, stage, and message fields

#### Scenario: Append an error entry
- **WHEN** an exception is captured during workflow execution
- **THEN** the pipeline SHALL append an error entry with normalized error object including name, message, and stack when available

### Requirement: Runtime Log Pipeline SHALL Instrument Trigger-Level and Job-Level Execution Boundaries
Runtime log 管道 MUST 为 Dashboard 提供可按任务维度过滤的检索契约。

#### Scenario: 按 requestId 过滤日志
- **WHEN** Dashboard backend 详情页指定 `requestId`
- **THEN** 系统 SHALL 返回仅属于该 request 的日志条目

#### Scenario: 按 jobId/workflowId 组合过滤日志
- **WHEN** Dashboard backend 详情页指定 `jobId` 或 `workflowId`
- **THEN** 系统 SHALL 返回满足过滤条件的日志条目
- **AND** 过滤结果可用于 Generic HTTP backend 任务详情页展示

### Requirement: Runtime Log Pipeline SHALL Default to Recording info/warn/error and Not Record debug by Default
The default runtime write policy SHALL record `info`, `warn`, and `error` levels while excluding `debug` unless explicitly enabled in future extension.

#### Scenario: Debug entry under default policy
- **WHEN** a debug-level write is attempted under default settings
- **THEN** the pipeline SHALL ignore it and keep stored entries unchanged

#### Scenario: Error entry under default policy
- **WHEN** an error-level write is attempted under default settings
- **THEN** the pipeline SHALL store the entry successfully

### Requirement: Runtime Log Pipeline SHALL Redact Sensitive Auth Data Before Storage
The system MUST prevent known secret-bearing fields from being persisted in runtime logs.

#### Scenario: Authorization header present in details
- **WHEN** a log entry includes auth header/token fields in details
- **THEN** the stored entry SHALL replace sensitive values with redacted placeholders

### Requirement: Generic HTTP dashboard logs MUST bind to explicitly selected task
系统 MUST 让 Generic HTTP backend 的日志面板绑定到用户显式选择的任务，不得在同 backend 新任务到达时自动切换目标。

#### Scenario: same backend receives a new task while viewing logs
- **WHEN** 用户正在查看某 backend 某任务的日志
- **AND** 同 backend 新任务开始执行
- **THEN** 日志面板 MUST 继续显示原绑定任务日志
- **AND** 仅在用户主动选择新任务后才切换日志目标

### Requirement: Generic HTTP dashboard logs MUST expose structured details drawer
系统 MUST 在 Generic HTTP backend 页面展示结构化日志详情抽屉，用于查看 scope/stage/workflowId/requestId/jobId/details/error 等信息。

#### Scenario: open log detail drawer
- **WHEN** 用户点击日志表中的某条日志
- **THEN** 页面 MUST 打开或更新日志详情抽屉
- **AND** 抽屉 MUST 展示该日志条目的结构化 payload

