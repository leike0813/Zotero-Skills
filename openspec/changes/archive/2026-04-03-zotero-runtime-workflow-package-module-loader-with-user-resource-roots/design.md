# Design

## Decision

- Workflow-package hooks/libs that rely on package-local imports use `.mjs`
- Zotero runtime package hooks load through fixed `resource://` roots, not `file://`
- Two fixed workflow module roots are used:
  - builtin workflows root
  - user workflows root
- Legacy single-workflow `.js` hooks keep the text-loader path

## Runtime module roots

- Introduce a generic workflow module resource bridge that:
  - registers the builtin workflows directory to a fixed builtin `resource://` root
  - registers the active user workflows directory to a fixed user `resource://` root
  - clears substitutions on shutdown
  - maps absolute hook paths to the correct `resource://...` specifier
- Resource substitutions refresh whenever builtin sync or workflow directory rescans change the active roots

## Loader behavior

- Workflow-package hooks in Zotero runtime:
  - require `.mjs`
  - resolve through the workflow module resource bridge
  - load via `ChromeUtils.importESModule(resource://...)`
  - never fall back to text-transform loading
- Legacy single-workflow hooks:
  - continue using the text-loader compatibility path
- Diagnostics are split into:
  - `manifest_validation_error` for invalid package hook extensions
  - `hook_import_error` for resource resolution or module import failures
  - `hook_export_error` for missing expected hook exports

## Tests and governance

- Runtime loader simulation only treats `resource://` and `chrome://` as valid ESM specifiers
- Add loader tests for builtin package, user package, and workflowDir refresh
- Keep governance rules that allow same-package imports and block cross-package imports
