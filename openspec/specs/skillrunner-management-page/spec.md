# skillrunner-management-page Specification

## Purpose
TBD - created by archiving change embed-skillrunner-management-ui. Update Purpose after archive.
## Requirements
### Requirement: Plugin MUST provide embedded SkillRunner management host
插件 MUST 在 Zotero 内提供 SkillRunner 管理页宿主，并加载后端原生 `/ui` 页面。

#### Scenario: open embedded management page from backend profile
- **WHEN** 用户从 SkillRunner backend profile 触发“进入管理页面”
- **THEN** 插件 MUST 在 Zotero 对话框内加载目标 `${baseUrl}/ui`
- **AND** 对话框标题 MUST 包含 backend id/baseUrl 便于区分

#### Scenario: UI basic auth is handled by browser prompt without credential storage
- **WHEN** 后端 `/ui` 启用 Basic Auth 认证
- **THEN** 插件 SHALL rely on browser-level auth prompt for credential input
- **AND** 插件 MUST NOT persist Basic Auth username/password in backend profile

