## MODIFIED Requirements

### Requirement: Auto-Start Switch SHALL Be Driven by Preflight Outcomes
自动拉起开关 MUST 由 preflight 成败驱动，且自动与手动路径均适用；开关状态 SHALL 持久化到 runtime state。

#### Scenario: Preflight success enables auto-start and persists
- **WHEN** 存在 runtime info 且任意一次 preflight 成功
- **THEN** 系统 SHALL 开启自动拉起
- **AND** 系统 SHALL 持久化 `autoStartPaused=false`

#### Scenario: Preflight failure disables auto-start and persists
- **WHEN** 存在 runtime info 且任意一次 preflight 失败
- **THEN** 系统 SHALL 关闭自动拉起
- **AND** 系统 SHALL 持久化 `autoStartPaused=true`

#### Scenario: Manual stop disables auto-start and persists
- **WHEN** 用户触发手动停止
- **THEN** 系统 SHALL 立即关闭自动拉起
- **AND** 系统 SHALL 持久化 `autoStartPaused=true`

### Requirement: Startup Behavior SHALL Run Deterministic Preflight Policy
插件启动时 MUST 先从持久化状态恢复自动拉起开关，再按开关执行 startup preflight。

#### Scenario: Startup hydrates persisted auto-start state
- **WHEN** 插件启动
- **THEN** 系统 SHALL 从 `skillRunnerLocalRuntimeStateJson.autoStartPaused` 恢复自动拉起会话开关
- **AND** 若该字段缺失，系统 SHALL 视为自动拉起关闭

#### Scenario: Startup preflight runs only when persisted auto-start is enabled
- **WHEN** 插件启动且持久化自动拉起状态为开启
- **THEN** 系统 SHALL 执行一次 startup preflight

#### Scenario: Startup preflight skips when persisted auto-start is disabled
- **WHEN** 插件启动且持久化自动拉起状态为关闭
- **THEN** 系统 SHALL 跳过 startup preflight
- **AND** 系统 SHALL 返回可观测的 skip stage
