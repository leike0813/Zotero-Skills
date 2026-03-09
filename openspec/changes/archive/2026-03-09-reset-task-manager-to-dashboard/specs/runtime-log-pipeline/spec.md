## MODIFIED Requirements

### Requirement: Runtime Log Pipeline SHALL Instrument Trigger-Level and Job-Level Execution Boundaries
Runtime log 管道 MUST 为 Dashboard 提供可按任务维度过滤的检索契约。

#### Scenario: 按 requestId 过滤日志
- **WHEN** Dashboard backend 详情页指定 `requestId`
- **THEN** 系统 SHALL 返回仅属于该 request 的日志条目

#### Scenario: 按 jobId/workflowId 组合过滤日志
- **WHEN** Dashboard backend 详情页指定 `jobId` 或 `workflowId`
- **THEN** 系统 SHALL 返回满足过滤条件的日志条目
- **AND** 过滤结果可用于 Generic HTTP backend 任务详情页展示
