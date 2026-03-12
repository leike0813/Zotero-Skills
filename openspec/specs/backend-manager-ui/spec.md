# backend-manager-ui Specification

## Purpose
TBD - created by archiving change embed-skillrunner-management-ui. Update Purpose after archive.
## Requirements
### Requirement: Backend Manager MUST expose SkillRunner management-page entry
系统 MUST 在 Backend Manager 的 SkillRunner profile 行提供“进入管理页面”动作，用于直接打开对应后端的管理 UI。

#### Scenario: skillrunner row provides model-cache refresh action
- **WHEN** Backend Manager renders `type=skillrunner` profile rows
- **THEN** row actions SHALL include `刷新模型缓存`
- **AND** clicking the action SHALL refresh model cache for current row backend only
- **AND** non-skillrunner rows SHALL NOT expose this action

