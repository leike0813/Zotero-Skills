# workflow-settings-domain-decoupling Specification

## Purpose
TBD - created by archiving change decouple-workflow-settings-domain. Update Purpose after archive.
## Requirements
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

### Requirement: Workflow parameter normalization SHALL support enum-as-recommendation when allowCustom is enabled
Workflow settings domain normalization MUST preserve custom string inputs for enum-backed parameters when the manifest explicitly enables `allowCustom`.

#### Scenario: Custom string survives enum normalization with allowCustom=true
- **WHEN** workflow parameter schema is `type=string`, `enum=[...]`, and `allowCustom=true`
- **AND** user-provided value is a non-empty string outside enum
- **THEN** normalized workflow params SHALL keep the provided value
- **AND** value SHALL still pass string-type normalization path

#### Scenario: Strict enum remains default
- **WHEN** workflow parameter schema is `type=string`, `enum=[...]`, and `allowCustom` is missing or false
- **AND** user-provided value is outside enum
- **THEN** normalization SHALL reject the out-of-enum value
- **AND** fallback behavior SHALL remain unchanged (default value or omission)

