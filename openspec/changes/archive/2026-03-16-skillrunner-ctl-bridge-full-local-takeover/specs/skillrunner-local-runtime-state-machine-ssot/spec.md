## ADDED Requirements

### Requirement: Local runtime control plane MUST be bridge-native

Local runtime lifecycle actions MUST be implemented by plugin bridge native methods instead of runtime dependency on `skill_runnerctl` command returns.

#### Scenario: deploy bootstrap uses bridge-native bootstrap

- **WHEN** local deploy enters bootstrap stage
- **THEN** plugin MUST execute bridge-native bootstrap action
- **AND** plugin MUST validate bootstrap report via inferred report path when payload path is absent

#### Scenario: ensure/start/stop/status/doctor use bridge-native actions

- **WHEN** manager executes local runtime action chain
- **THEN** manager MUST call bridge-native local actions for `preflight/up/down/status/doctor`
- **AND** manager MUST NOT require ctl JSON payload as runtime source of truth

#### Scenario: up action owns state file lifecycle

- **WHEN** bridge-native up starts runtime successfully
- **THEN** bridge MUST write local runtime state file with pid/host/port metadata
- **AND** bridge MUST wait for health before returning success
- **AND** timeout MUST terminate process and clear state file
