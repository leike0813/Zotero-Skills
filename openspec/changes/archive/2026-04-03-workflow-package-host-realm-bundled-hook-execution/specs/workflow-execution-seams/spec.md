## MODIFIED Requirements

### Requirement: Workflow package hooks SHALL execute in host realm on Zotero runtime
Workflow-package hooks MUST execute through a host-realm bundled temp script on Zotero runtime, instead of directly importing `resource://...mjs` modules.

#### Scenario: Zotero runtime package hook execution
- **WHEN** a workflow-package hook is loaded on Zotero runtime
- **THEN** the loader bundles the package hook entry and same-package relative dependencies into a temp script
- **AND** the hook executes through the host realm loader path

### Requirement: Workflow package bundling SHALL enforce same-package import boundaries
The package hook bundler MUST only allow same-package relative imports and MUST reject unsupported module syntax with deterministic diagnostics.

#### Scenario: Unsupported package import
- **WHEN** a package hook imports a missing file, escapes the package root, or uses unsupported syntax
- **THEN** the loader emits `hook_import_error` diagnostics and skips loading that workflow

### Requirement: Workflow package runtime diagnostics SHALL describe execution mode
Workflow diagnostics and debug probe output MUST report the execution mode and capability source used by the active hook runtime.

#### Scenario: Debug probe inspects a package workflow
- **WHEN** workflow debug probe evaluates a package workflow on Zotero runtime
- **THEN** the result includes `executionMode=package-host-bundle`
- **AND** the result no longer includes bridge or token diagnostic fields removed from the runtime model
