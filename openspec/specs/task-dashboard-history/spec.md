# task-dashboard-history Specification

## Purpose
TBD - created by archiving change reset-task-manager-to-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Dashboard MUST persist local task history for 30 days
系统 MUST 为 Dashboard 维护本地任务历史账本，支持历史回看与 backend 分组统计。

#### Scenario: 终态任务写入历史
- **WHEN** 任务进入终态（succeeded/failed/canceled）
- **THEN** 系统 MUST 将任务记录写入本地历史
- **AND** 历史记录 MUST 包含 backend/provider/workflow/job/request 元数据

#### Scenario: 历史数据按 30 天淘汰
- **WHEN** Dashboard 启动或历史写入发生
- **THEN** 系统 MUST 清理超过 30 天的历史记录
- **AND** 清理后统计与列表 MUST 仅基于保留记录

