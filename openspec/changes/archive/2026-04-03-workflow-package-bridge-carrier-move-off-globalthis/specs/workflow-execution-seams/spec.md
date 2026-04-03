## ADDED Requirements

### Requirement: Workflow-package capability bridge carrier

Package workflow modules MUST resolve execution capability snapshots from an addon-hosted workflow runtime bridge before consulting any global compatibility mirror.

#### Scenario: Package hook resolves capability snapshot through addon data

- **WHEN** a package workflow hook executes with a valid `workflowExecutionToken`
- **THEN** the runtime bridge is resolved from `addon.data.workflowRuntimeBridge` when available
- **AND** the capability snapshot is read from that bridge before any global fallback is used

#### Scenario: Diagnostics expose bridge carrier

- **WHEN** package workflow diagnostics or debug probe output report bridge state
- **THEN** the output includes the bridge carrier identity
- **AND** the carrier distinguishes `addon-data`, `global-fallback`, and `unresolved`

