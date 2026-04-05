## ADDED Requirements

### Requirement: Workflow manifest schema SHALL support explicit selection trigger policy
The standalone workflow manifest schema MUST allow authors to declare whether a workflow requires a Zotero selection before it can be triggered.

#### Scenario: Author declares selection-independent workflow
- **WHEN** a workflow manifest declares `"trigger": { "requiresSelection": false }`
- **THEN** schema validation SHALL accept the manifest as valid
- **AND** runtime loader validation SHALL not emit a `manifest_validation_error` for this field

#### Scenario: Author omits trigger policy
- **WHEN** a workflow manifest omits the `trigger` block or omits `trigger.requiresSelection`
- **THEN** schema validation SHALL accept the manifest
- **AND** runtime contract SHALL default to selection-required semantics

#### Scenario: Author provides invalid trigger policy type
- **WHEN** a workflow manifest declares `trigger.requiresSelection` as a non-boolean value
- **THEN** schema validation SHALL reject the manifest with deterministic diagnostics
