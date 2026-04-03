## MODIFIED Requirements

### Requirement: Workflow package runtime diagnostics SHALL be debug-gated
Workflow-package runtime diagnostics MUST remain silent in normal mode and MUST emit structured diagnostics only when the hardcoded debug mode is enabled.

#### Scenario: Debug mode disabled
- **WHEN** workflow-package loader, execution scope, or package-local runtime accessors run in normal mode
- **THEN** no additional workflow-package diagnostic log entries are emitted

#### Scenario: Debug mode enabled
- **WHEN** the hardcoded debug mode is enabled
- **THEN** workflow-package diagnostics are emitted to runtime logs and Zotero console output

### Requirement: Workflow package loader diagnostics SHALL cover runtime module resolution
Workflow-package diagnostics MUST record resource-root registration and runtime module import outcomes.

#### Scenario: Runtime package hook import
- **WHEN** a workflow-package hook is imported through the runtime module path
- **THEN** diagnostics record the module import start, resolved module specifier, and success or failure outcome

### Requirement: Workflow package execution diagnostics SHALL describe capability scope
Workflow hook execution diagnostics MUST record hook execution start and failure with capability summaries for the active runtime scope.

#### Scenario: Hook execution in debug mode
- **WHEN** a package hook executes in debug mode
- **THEN** diagnostics include the workflow id, package id, hook name, workflow source kind, and capability summary for the active runtime scope

### Requirement: Package-local runtime accessor diagnostics SHALL record fallback and missing capability cases
Package-local runtime accessors MUST record debug diagnostics when they fall back to global runtime objects or fail because a capability is unavailable.

#### Scenario: Capability missing
- **WHEN** a package-local runtime accessor cannot resolve a required capability
- **THEN** diagnostics record the accessor stage and failure without changing workflow behavior
