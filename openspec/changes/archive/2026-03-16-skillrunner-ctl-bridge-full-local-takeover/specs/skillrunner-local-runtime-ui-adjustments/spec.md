## ADDED Requirements

### Requirement: Manual local runtime command guidance MUST match bridge-native flow

User-facing manual deploy command text MUST reflect bridge-native execution flow and MUST NOT expose deprecated ctl command path.

#### Scenario: manual deploy command text generation

- **WHEN** user requests manual deploy commands
- **THEN** command text MUST include `agent_manager.py --ensure` bootstrap step
- **AND** command text MUST include direct `uvicorn` startup step
- **AND** command text MUST NOT include `skill-runnerctl` commands
