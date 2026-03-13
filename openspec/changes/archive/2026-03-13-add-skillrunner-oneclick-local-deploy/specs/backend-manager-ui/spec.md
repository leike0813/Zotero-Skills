## MODIFIED Requirements

### Requirement: Backend Manager MUST expose SkillRunner management-page entry
系统 MUST 在 Backend Manager 的 SkillRunner profile 行提供“进入管理页面”动作，用于直接打开对应后端的管理 UI。

#### Scenario: local deploy auto-profile conflict is surfaced without overwrite
- **WHEN** Preferences local deploy flow attempts to auto-create `skillrunner-local` profile but Backend Manager data already contains conflicting entry
- **THEN** system SHALL present a conflict warning for manual resolution
- **AND** system SHALL NOT overwrite the existing Backend Manager profile automatically
