## ADDED Requirements

### Requirement: Workflow-package hooks SHALL consume explicit runtime capability scope

Workflow-package hooks and package-local helper modules SHALL consume execution capabilities from the explicit workflow runtime scope provided by the execution chain rather than relying on shared globals.

#### Scenario: Package hook executes in Zotero ESM without shared globals

- **WHEN** a workflow-package hook executes in Zotero runtime
- **THEN** package helpers SHALL resolve `prefs/items/fetch/base64` capabilities from the hook-scoped runtime capability scope
- **AND** package execution SHALL NOT require `globalThis.Zotero` or `globalThis.addon` to be present as the primary path

### Requirement: Workflow-package runtime helpers SHALL provide a single capability access path

Each workflow-package SHALL expose one package-local runtime helper module that normalizes capability access for package code.

#### Scenario: Package helper needs Zotero prefs or items APIs

- **WHEN** package code needs a runtime capability such as `Prefs` or `Items`
- **THEN** it SHALL obtain that capability through the package-local runtime helper
- **AND** capability failures SHALL come from the runtime helper rather than ad hoc business code
