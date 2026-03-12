## ADDED Requirements

### Requirement: Dashboard and Run dialog SHALL render SkillRunner state semantics from host SSOT snapshot
Dashboard 与 Run Dialog SHALL 仅消费宿主快照中的状态语义字段，不再在前端复制独立状态机判定。

#### Scenario: terminal/waiting semantics are consumed from host snapshot
- **WHEN** dashboard or run-dialog frontend receives host snapshot payload
- **THEN** frontend MUST use host-provided state semantics fields for terminal/waiting behavior
- **AND** frontend MUST NOT maintain an independent terminal/waiting inference matrix

#### Scenario: waiting states remain non-terminal in UI control gating
- **WHEN** snapshot status is `waiting_user` or `waiting_auth`
- **THEN** UI controls and hints MUST follow waiting semantics from host fields
- **AND** task row/run dialog MUST NOT treat waiting as failure or completion
