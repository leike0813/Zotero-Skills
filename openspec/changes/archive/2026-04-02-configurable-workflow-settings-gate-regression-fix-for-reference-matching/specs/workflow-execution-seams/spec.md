## ADDED Requirements

### Requirement: Configurable workflow trigger failures SHALL be observable

Configurable workflows that require a pre-submit settings gate MUST NOT fail
silently during menu-triggered execution.

#### Scenario: Settings gate fails before execution starts

- **WHEN** a configurable workflow trigger reaches the settings gate
- **AND** dialog creation or gate initialization fails
- **THEN** the system SHALL emit a runtime log entry describing the failure
- **AND** the user SHALL receive explicit failure feedback
- **AND** the workflow SHALL NOT silently no-op

### Requirement: Workflow source SHALL be included in trigger diagnostics

Trigger diagnostics MUST identify whether the loaded workflow came from the
builtin registry or a user override.

#### Scenario: Builtin workflow is shadowed by user workflow

- **WHEN** a workflow trigger fails for a workflow ID that exists in both
  builtin and user directories
- **THEN** runtime diagnostics SHALL include the currently loaded workflow
  source
- **AND** operators SHALL be able to distinguish builtin regression from user
  override behavior
