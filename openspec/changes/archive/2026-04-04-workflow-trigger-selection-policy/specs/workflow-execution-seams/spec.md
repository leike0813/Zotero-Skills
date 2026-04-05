## ADDED Requirements

### Requirement: Workflow trigger selection gating SHALL follow explicit manifest policy
Workflow trigger gating MUST read the manifest-level `trigger.requiresSelection` contract rather than inferring empty-selection eligibility from provider shape.

#### Scenario: Workflow omits explicit no-selection trigger policy
- **WHEN** a workflow is triggered with no selected items
- **AND** the manifest omits `trigger.requiresSelection` or does not set it to `false`
- **THEN** the menu SHALL render that workflow as disabled for `no selection`
- **AND** the preparation seam SHALL reject execution before request build

#### Scenario: Workflow explicitly allows no-selection trigger
- **WHEN** a workflow manifest declares `"trigger": { "requiresSelection": false }`
- **AND** the workflow is triggered with no selected items
- **THEN** the menu SHALL keep that workflow enabled
- **AND** the preparation seam SHALL allow execution to continue
- **AND** runtime request build SHALL create exactly one empty-selection execution unit for that trigger

### Requirement: Empty-selection eligibility SHALL NOT be inferred from provider kind
The execution system MUST NOT treat `provider`, `request.kind`, or missing `inputs.unit` as implicit permission to run without selection.

#### Scenario: Pass-through workflow still requires selection by default
- **WHEN** a `pass-through` workflow does not declare `trigger.requiresSelection: false`
- **AND** the current selection is empty
- **THEN** the workflow SHALL remain disabled and non-executable
- **AND** the system SHALL NOT silently fall back to provider-based no-selection execution
