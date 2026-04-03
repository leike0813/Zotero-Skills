## ADDED Requirements

### Requirement: Workflow-package hooks SHALL load through runtime resource roots in Zotero

Workflow-package hooks that rely on package-local module imports SHALL load through fixed workflow `resource://` roots in Zotero runtime rather than `file://` URIs.

#### Scenario: Builtin workflow-package hook loads through builtin resource root

- **WHEN** a builtin workflow-package hook is loaded in Zotero runtime
- **THEN** the loader SHALL resolve it through the builtin workflow `resource://` root
- **AND** package-local relative imports SHALL remain available

#### Scenario: User workflow-package hook loads through user resource root

- **WHEN** a user workflow-package hook is loaded in Zotero runtime
- **THEN** the loader SHALL resolve it through the user workflow `resource://` root
- **AND** package-local relative imports SHALL remain available

### Requirement: Workflow module roots SHALL track active builtin and user workflow directories

The runtime workflow module roots SHALL stay synchronized with the active builtin workflows directory and the active user workflows directory.

#### Scenario: User workflow directory changes on rescan

- **WHEN** the active workflow directory changes before a workflow rescan
- **THEN** the user workflow `resource://` root SHALL refresh to the new directory
- **AND** subsequent user workflow-package imports SHALL resolve against the new root

### Requirement: Workflow-package diagnostics SHALL distinguish import failures from export failures

Workflow-package loading diagnostics SHALL distinguish runtime module import failures from missing expected hook exports.

#### Scenario: Package module import fails

- **WHEN** a workflow-package hook module cannot be imported through the runtime module loader
- **THEN** the loader SHALL emit `hook_import_error`

#### Scenario: Package module loads but expected export is missing

- **WHEN** a workflow-package hook module loads successfully but does not export the expected hook function
- **THEN** the loader SHALL emit `hook_export_error`
