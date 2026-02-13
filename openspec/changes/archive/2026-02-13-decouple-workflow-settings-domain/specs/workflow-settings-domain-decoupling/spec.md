## ADDED Requirements

### Requirement: Workflow settings domain SHALL be isolated from dialog rendering

Settings persistence, normalization, and execution-merge logic MUST be exposed via domain contracts independent of UI/dialog rendering code.

#### Scenario: Dialog initializes from domain snapshot

- **WHEN** a workflow settings dialog is opened
- **THEN** initial persistent and run-once values are produced by domain APIs
- **AND** dialog code does not duplicate domain merge/normalization rules

### Requirement: Run-once defaults SHALL reset from persisted settings on each open

The system MUST keep existing behavior where run-once defaults are re-initialized from latest persisted settings whenever dialog opens.

#### Scenario: Persisted update affects next dialog open

- **WHEN** user saves new persistent settings
- **AND** later reopens the same workflow settings dialog
- **THEN** run-once defaults reflect latest persisted values

### Requirement: Execution settings resolution SHALL remain behavior-equivalent

Execution context consumed by workflow runtime MUST preserve existing precedence and normalization semantics.

#### Scenario: Run-once overrides merged with persisted settings

- **WHEN** run-once settings are applied for a workflow execution
- **THEN** produced execution settings match current behavior for `profileId`, `workflowParams`, and `providerOptions`
- **AND** existing validation fallback behavior remains unchanged

### Requirement: Settings domain SHALL be independently testable

Domain contracts MUST support regression testing without requiring dialog rendering.

#### Scenario: Domain-level parity test

- **WHEN** tests call settings-domain APIs directly
- **THEN** they can verify normalization, merge precedence, and reset-on-open semantics without opening dialog UI
