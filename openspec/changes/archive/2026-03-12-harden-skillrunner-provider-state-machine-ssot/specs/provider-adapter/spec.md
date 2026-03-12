## ADDED Requirements

### Requirement: SkillRunner provider chain SHALL consume a single plugin-side state machine SSOT
SkillRunner provider/client/reconciler 全链路 SHALL 复用同一个插件侧状态机语义，避免分散判定导致漂移。

#### Scenario: unknown backend status degrades to safe non-terminal state with diagnostics
- **WHEN** provider/client or reconciler receives an unknown status value from backend or runtime payload
- **THEN** plugin MUST normalize it to canonical safe non-terminal status (`running`)
- **AND** plugin MUST emit structured state-machine diagnostics (`ruleId`, `requestId`, `action=degraded`)

#### Scenario: illegal status transition is guarded without hard failure
- **WHEN** chain observes a transition outside the legal transition matrix
- **THEN** plugin MUST record a state-machine warning with transition context
- **AND** plugin MUST apply degradation path instead of throwing hard runtime error

#### Scenario: key event order invariants are enforced
- **WHEN** runtime event sequence violates invariant rules (`request-created`, `deferred`, `waiting-resumed`, `apply-succeeded once`)
- **THEN** plugin MUST emit state-machine diagnostics with violated `ruleId`
- **AND** plugin MUST continue execution with degraded behavior
