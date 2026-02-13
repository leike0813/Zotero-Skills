## ADDED Requirements

### Requirement: High-risk execution paths SHALL have explicit smoke coverage
The project SHALL provide smoke tests for high-risk user-facing execution paths identified during hardening.

#### Scenario: Critical execution chain has smoke test
- **WHEN** a high-risk critical path is identified
- **THEN** at least one smoke test covers its success path

#### Scenario: Smoke test belongs to lite suite where applicable
- **WHEN** smoke test validates a critical and fast path
- **THEN** it is eligible for `lite` suite membership

### Requirement: Fragile behavior SHALL have targeted regression tests
Known fragile or previously escaped behaviors SHALL be protected by explicit regression tests.

#### Scenario: Historical defect class gets regression case
- **WHEN** a defect class is marked high-risk
- **THEN** a regression test is added or updated to cover it

#### Scenario: Regression depth is assigned to appropriate suite
- **WHEN** regression test is long-running or environment-heavy
- **THEN** it is assigned to `full` suite

### Requirement: Reinforcement tests SHALL be traceable to risk rationale
Each reinforcement test SHALL include traceability to the risk item or defect class it mitigates.

#### Scenario: Reviewer inspects added test
- **WHEN** reviewer checks new smoke/regression case
- **THEN** risk rationale is available in test metadata, comments, or linked backlog reference

