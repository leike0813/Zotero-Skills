## ADDED Requirements

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

