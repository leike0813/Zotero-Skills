## ADDED Requirements

### Requirement: Dashboard backend log panel MUST provide navigation to diagnostic export
系统 MUST 在 Dashboard backend 日志区域提供跳转到诊断导出的入口，避免在 Dashboard 内重复实现独立导出面板。

#### Scenario: open diagnostic export from backend log section
- **WHEN** 用户在 backend 日志区域点击“诊断导出”入口
- **THEN** 系统 MUST 打开日志窗口并聚焦诊断导出操作
- **AND** 保留当前 backend/任务过滤上下文用于导出构建
