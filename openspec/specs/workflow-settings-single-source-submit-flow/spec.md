# workflow-settings-single-source-submit-flow Specification

## Purpose
TBD - created by archiving change workflow-settings-single-source-web-config. Update Purpose after archive.
## Requirements
### Requirement: Workflow settings SHALL use a single persisted source plus optional submit-time override
The system MUST treat `workflowSettingsJson` as the only persisted workflow settings source.  
Execution MUST merge persisted settings with an optional per-submit override snapshot, and MUST NOT consume run-once state.

#### Scenario: Execute with persisted settings only
- **WHEN** a workflow execution is triggered without submit override
- **THEN** execution context SHALL resolve from persisted workflow settings only
- **AND** no run-once state SHALL be read or mutated

#### Scenario: Execute with submit-time override
- **WHEN** a workflow execution is triggered with submit override
- **THEN** execution context SHALL merge persisted settings with that override for this execution
- **AND** persisted settings SHALL remain unchanged unless explicitly saved

### Requirement: Interactive workflow trigger SHALL enforce a pre-submit settings gate for configurable workflows
Interactive triggers MUST open workflow-specific settings page before submit when the target workflow has configurable dimensions.

#### Scenario: Configurable workflow opens submit settings page
- **WHEN** user triggers a configurable workflow from interactive entry
- **THEN** system SHALL open a workflow-specific web settings dialog
- **AND** submit SHALL continue only after user confirms

#### Scenario: Non-configurable workflow bypasses settings page
- **WHEN** user triggers a workflow with no configurable dimensions
- **THEN** system SHALL skip settings dialog
- **AND** system SHALL submit workflow directly

#### Scenario: Required backend profile is unavailable
- **WHEN** workflow requires backend profile and no candidate profile exists
- **THEN** dialog SHALL show a blocking message
- **AND** confirm action SHALL be disabled
- **AND** workflow SHALL NOT be submitted

#### Scenario: Settings gate initialization fails
- **WHEN** user triggers a configurable workflow from interactive entry
- **AND** settings dialog initialization fails before confirmation
- **THEN** system SHALL emit explicit failure feedback
- **AND** runtime diagnostics SHALL record the gate failure
- **AND** workflow SHALL NOT silently no-op

### Requirement: A single submit snapshot SHALL be shared by all jobs in the same batch
For one trigger action, execution settings snapshot MUST be resolved once and shared by all jobs generated from that submission.

#### Scenario: Multi-job batch shares identical snapshot
- **WHEN** one trigger produces multiple jobs
- **THEN** all jobs SHALL use the same resolved workflow params and provider options snapshot
- **AND** no per-job re-resolution SHALL change configuration within that batch

### Requirement: Dashboard SHALL expose persistent workflow options as a dedicated top-level tab
Dashboard MUST provide a top-level `Workflow选项 / Workflow Options` tab with workflow sub tabs for configurable workflows only.

#### Scenario: Workflow options tab only shows configurable workflows
- **WHEN** dashboard renders workflow options
- **THEN** only workflows with configurable dimensions SHALL be listed as sub tabs
- **AND** workflows without configurable dimensions SHALL be hidden

#### Scenario: Dashboard editing persists with debounce
- **WHEN** user edits a field in workflow options tab
- **THEN** system SHALL persist changes with debounce
- **AND** save state SHALL be observable as `saving/saved/error`

### Requirement: Workflow options editing SHALL remain stable while typing
The system MUST prevent periodic/task-update refresh from rebuilding workflow-options form while the user is editing fields.

#### Scenario: Periodic refresh is skipped in workflow-options tab
- **GIVEN** dashboard is currently on `workflow-options` tab
- **WHEN** periodic refresh or task-update refresh is triggered
- **THEN** workflow-options form SHALL NOT be rebuilt by that refresh
- **AND** user focus and dropdown interaction SHALL remain stable

### Requirement: SkillRunner runtime options SHALL be mode-gated
For SkillRunner workflows, UI exposure and request payload MUST follow `execution.skillrunner_mode`.

#### Scenario: Interactive mode options
- **WHEN** workflow mode is `interactive`
- **THEN** UI SHALL show `interactive_auto_reply` and `hard_timeout_seconds`
- **AND** request payload SHALL NOT include `no_cache`

#### Scenario: Auto mode options
- **WHEN** workflow mode is `auto`
- **THEN** UI SHALL show `no_cache` and `hard_timeout_seconds`
- **AND** request payload SHALL NOT include `interactive_auto_reply`

### Requirement: Submit dialog SHALL use compact layout and single cancel affordance
The submit dialog MUST remove framework-level duplicate cancel button and keep only page-level actions.

#### Scenario: No duplicate cancel button
- **WHEN** submit dialog is rendered
- **THEN** only in-page confirm/cancel actions SHALL be visible
- **AND** framework chrome SHALL NOT add an extra cancel button
