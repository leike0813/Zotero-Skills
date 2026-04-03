## ADDED Requirements

### Requirement: Workflow-package hooks SHALL use true module loading in Zotero runtime

Workflow-package hooks SHALL use true module loading in Zotero runtime so package-local relative imports work without depending on the legacy text-transform loader.

#### Scenario: package hook loads through Zotero runtime module path

- **WHEN** a workflow is declared from a `workflow-package.json`
- **THEN** its hook modules load through the runtime module loader
- **AND** package-local relative imports resolve correctly
- **AND** the legacy text-transform fallback is not the primary execution path for that hook

### Requirement: Workflow-package hook modules SHALL use `.mjs`

Workflow-package hook and package-local shared module files SHALL use `.mjs`.

#### Scenario: package hook manifest points to `.mjs`

- **WHEN** a workflow hook is declared from a workflow package
- **THEN** the hook path ends with `.mjs`
- **AND** package-local shared modules imported by that hook also use `.mjs`
