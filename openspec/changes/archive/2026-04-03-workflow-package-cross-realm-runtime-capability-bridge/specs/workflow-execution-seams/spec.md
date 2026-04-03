## ADDED Requirements

### Requirement: Workflow-package capability access must be bridge-backed across realms

When a workflow is loaded from a workflow-package and executed as a `resource://...` module, runtime capabilities MUST be resolved through a cross-realm execution capability bridge instead of relying on direct cross-realm runtime-object transport or realm-local globals.

#### Scenario: Package hook execution receives a bridge token

- **WHEN** core runtime executes a package workflow hook
- **THEN** it MUST register a capability snapshot in the runtime bridge
- **AND** it MUST pass a stable `workflowExecutionToken` to the hook runtime context
- **AND** it MUST release the token after hook execution finishes

#### Scenario: Package runtime accessor resolves capabilities through bridge first

- **WHEN** package-local runtime accessors need `Zotero`, `Prefs`, `Items`, `fetch`, or codec helpers
- **THEN** they MUST first resolve the current capability snapshot via `workflowExecutionToken`
- **AND** only use runtime-object inspection or `globalThis` as compatibility fallback

#### Scenario: Diagnostics expose bridge resolution state

- **WHEN** package hook execution or package runtime accessor diagnostics are emitted
- **THEN** diagnostics MUST include bridge-state fields
- **AND** those fields MUST include `hasExecutionToken`, `bridgeResolved`, `bridgeToken`, and `capabilitySource`
