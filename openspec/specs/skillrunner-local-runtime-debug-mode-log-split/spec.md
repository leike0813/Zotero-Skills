# skillrunner-local-runtime-debug-mode-log-split Specification

## Purpose
TBD - created by archiving change skillrunner-local-runtime-debug-mode-log-split. Update Purpose after archive.
## Requirements
### Requirement: Local runtime logging SHALL be split by channel
Local runtime one-click actions SHALL emit persistent runtime logs for key milestones while keeping debug-console logs as an independent diagnostic channel.

#### Scenario: Key deploy/uninstall milestone is logged persistently
- **WHEN** local runtime manager emits a key action-stage log for deploy/oneclick/lease-acquire/uninstall chains
- **THEN** the entry SHALL be appended to persistent runtime logs
- **AND** the entry SHALL include local-runtime component identity and stage metadata

#### Scenario: Monitoring and polling logs are excluded from persistence
- **WHEN** local runtime manager emits monitoring/polling telemetry (heartbeat/reconcile/auto-ensure/ensure loops)
- **THEN** the entry SHALL NOT be appended to persistent runtime logs

### Requirement: Debug console logging SHALL be gated by hardcoded debug mode
Debug console logging for local runtime deploy/uninstall SHALL only be active when debug mode is enabled.

#### Scenario: Debug mode disabled
- **WHEN** debug mode is disabled
- **THEN** local deploy debug store append/reset operations SHALL not create debug entries

#### Scenario: Debug mode enabled
- **WHEN** debug mode is enabled
- **THEN** local deploy debug store SHALL capture manager/bridge debug logs as before

### Requirement: Debug-only surfaces SHALL be hidden when debug mode is disabled
Preferences and context-menu debug surfaces SHALL be visible only in debug mode.

#### Scenario: Preferences debug console button
- **WHEN** debug mode is disabled
- **THEN** the local runtime debug console button in preferences SHALL be hidden
- **AND** debug console command SHALL not be dispatched from preferences

#### Scenario: Selection debug menus
- **WHEN** debug mode is disabled
- **THEN** right-click menu entries for sampling/validating selection context SHALL not be registered

#### Scenario: Forced prefs event with debug mode disabled
- **WHEN** `openSkillRunnerLocalDeployDebugConsole` is invoked while debug mode is disabled
- **THEN** the event SHALL return a disabled result
- **AND** debug dialog SHALL not be opened

