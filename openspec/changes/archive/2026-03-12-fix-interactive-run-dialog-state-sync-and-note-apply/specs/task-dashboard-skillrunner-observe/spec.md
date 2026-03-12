## MODIFIED Requirements

### Requirement: Dashboard MUST provide SkillRunner run observation and interaction view
Dashboard 与 Run Dialog MUST 以后端快照为主，统一渲染 SkillRunner 交互态与运行态。

#### Scenario: interaction/auth control events trigger authoritative state refresh
- **WHEN** run dialog receives `interaction.reply.*` / `interaction.pending.*` / `auth.*` chat events
- **THEN** host MUST trigger a debounced state refresh (`getRun` + `getPending` + history catch-up)
- **AND** waiting cards and status badge MUST converge to backend latest state

#### Scenario: leaving waiting state clears pending cards immediately
- **WHEN** backend status becomes non-`waiting_user` and non-`waiting_auth`
- **THEN** host MUST clear pending interaction/auth snapshot fields
- **AND** prompt/auth cards MUST be hidden in next snapshot
