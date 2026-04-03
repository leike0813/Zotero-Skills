# Design

## Decision

- Package-local shared hook/lib modules use `.mjs`
- All workflow packages, builtin and user, use the same Zotero runtime package module path
- Legacy single-workflow hooks keep the text-loader fallback path
- Workflow-package hooks do not use text-transform fallback

## Loader

- Distinguish workflow-package hooks from legacy single-workflow hooks at load time
- For workflow-package hooks:
  - require `.mjs` hook paths
  - in Zotero runtime, load with true module import
  - if import fails, surface `hook_import_error`
- For legacy single-workflow hooks:
  - keep current text-transform fallback behavior
  - no new `.mjs` requirement

## Builtin migration

- Migrate `tag-vocabulary-package` hooks/lib to `.mjs`
- Migrate `reference-workbench-package` hooks/lib to `.mjs`
- Update package-local imports, child workflow manifests, builtin manifest sync list, and tests

## Governance

- Same-package imports remain allowed
- Cross-package imports remain forbidden
- Add a guard that workflow-package hook/lib files using package-local imports are `.mjs`
