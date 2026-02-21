# workflow-manifest-authoring-schema Specification

## Purpose
TBD - created by archiving change add-workflow-manifest-schema-file. Update Purpose after archive.
## Requirements
### Requirement: Project SHALL provide a standalone workflow manifest schema file for authors
The project MUST provide a standalone schema file that describes how users should write `workflow.json` manifests.

#### Scenario: Author looks up workflow contract
- **WHEN** a user needs to create or edit a workflow manifest
- **THEN** they can find a dedicated schema file without reading loader source code

#### Scenario: Schema describes minimum valid manifest
- **WHEN** user validates a minimal workflow manifest against the schema
- **THEN** required core fields (`id`, `label`, `hooks.applyResult`) are explicitly enforced

### Requirement: Schema contract SHALL align with current loader-visible constraints
The standalone schema MUST align with the current runtime-visible manifest constraints for critical fields and deprecated-field rejection.

#### Scenario: skillrunner mixed-input declaration remains representable
- **WHEN** a workflow declares `request.kind = "skillrunner.job.v1"` and provides `request.input` with inline payload fields together with `request.input.upload.files`
- **THEN** workflow manifest schema SHALL accept that declaration as valid authoring input
- **AND** schema SHALL keep `request.input` extensible for backend-evolving inline fields while preserving typed upload structure checks

### Requirement: Runtime loader manifest validation SHALL use the standalone schema as SSOT
The loader MUST validate workflow manifests against the standalone schema during workflow scan.

#### Scenario: Runtime scan uses schema validation
- **WHEN** workflow registry scans user workflows
- **THEN** loader SHALL evaluate manifest shape using the standalone schema
- **AND** invalid manifests SHALL be emitted as `manifest_validation_error` diagnostics

#### Scenario: Schema update changes runtime acceptance boundary
- **WHEN** schema constraints are tightened or relaxed
- **THEN** runtime manifest validation behavior SHALL follow the updated schema boundary
- **AND** no parallel hardcoded shape gate SHALL override schema decisions

### Requirement: Workflow parameter schema SHALL support optional allowCustom for enum-backed string parameters
Workflow manifest authoring schema MUST allow parameter authors to declare whether `enum` values are strict constraints or recommended options.

#### Scenario: Author declares enum with allowCustom enabled
- **WHEN** a workflow parameter defines `type: "string"`, an `enum` list, and `allowCustom: true`
- **THEN** manifest schema validation SHALL accept the declaration
- **AND** runtime contract SHALL treat enum as recommended values for that parameter

#### Scenario: Author omits allowCustom
- **WHEN** a workflow parameter defines `enum` but does not define `allowCustom`
- **THEN** manifest schema validation SHALL accept the declaration
- **AND** runtime behavior SHALL default to strict-enum semantics

#### Scenario: Author provides invalid allowCustom type
- **WHEN** a workflow parameter sets `allowCustom` to a non-boolean value
- **THEN** manifest schema validation SHALL reject the manifest with deterministic diagnostics

### Requirement: Workflow manifest schema SHALL support per-workflow execution reminder control
The standalone workflow manifest schema MUST allow workflows to declare whether workflow execution reminders are shown via `execution.feedback.showNotifications`.

#### Scenario: Author enables reminder suppression declaratively
- **WHEN** a workflow manifest declares `"execution": { "feedback": { "showNotifications": false } }`
- **THEN** schema validation SHALL accept the manifest as valid
- **AND** runtime loader validation SHALL not emit a `manifest_validation_error` for this field

#### Scenario: Invalid reminder switch type is rejected
- **WHEN** a workflow manifest declares `execution.feedback.showNotifications` as a non-boolean value
- **THEN** schema validation SHALL reject the manifest
- **AND** workflow loader SHALL surface deterministic manifest validation diagnostics

