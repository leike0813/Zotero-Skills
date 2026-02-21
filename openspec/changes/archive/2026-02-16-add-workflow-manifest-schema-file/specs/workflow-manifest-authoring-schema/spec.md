## ADDED Requirements

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

#### Scenario: Legacy manifest fields are rejected
- **WHEN** manifest includes deprecated fields currently rejected by loader
- **THEN** schema contract SHALL mark them invalid as authoring input

#### Scenario: Major optional sections remain representable
- **WHEN** user declares optional sections (`provider`, `parameters`, `inputs`, `execution`, `result`, `request`, `hooks`)
- **THEN** schema SHALL define these structures with clear types

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
