## ADDED Requirements

### Requirement: Local runtime status copy SHALL be action-specific and localized
Preferences local-runtime status text SHALL use action-specific localized copy for in-progress actions and stage-localized copy for user-visible results.

#### Scenario: Action-specific in-progress status
- **WHEN** one-click resolves to deploy
- **THEN** in-progress status SHALL show localized deploy-working copy
- **WHEN** one-click resolves to start
- **THEN** in-progress status SHALL show localized start-working copy
- **WHEN** stop is invoked
- **THEN** in-progress status SHALL show localized stop-working copy
- **WHEN** uninstall is invoked
- **THEN** in-progress status SHALL show localized uninstall-working copy

#### Scenario: Stage-localized user-visible result
- **WHEN** local-runtime action returns a known stage
- **THEN** status renderer SHALL use localized stage message as primary text body
- **AND** existing `ok/conflict/failed` prefix behavior SHALL remain unchanged

#### Scenario: Compatibility fallback chain
- **WHEN** stage-localized copy is unavailable
- **THEN** status renderer SHALL fallback to existing response `message`
- **AND** if response `message` is empty, renderer SHALL fallback to localized unknown message
