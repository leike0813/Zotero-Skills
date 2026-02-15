## 1. Shared Assertion Utility

- [x] 1.1 Add a shared workflow summary count assertion helper with canonical keys (`succeeded`, `failed`, `skipped`)
- [x] 1.2 Implement localized label alias mapping (at least English and Chinese) in the shared helper
- [x] 1.3 Add/adjust helper-level tests to cover canonical and localized summary parsing

## 2. Workflow Suite Migration

- [x] 2.1 Migrate `workflow-reference-matching` summary assertions to the shared helper
- [x] 2.2 Migrate `workflow-literature-digest` summary assertions to the shared helper
- [x] 2.3 Migrate `workflow-reference-note-editor` summary assertions to the shared helper
- [x] 2.4 Remove duplicated suite-local summary assertion/parsing helpers after migration

## 3. Validation

- [x] 3.1 Run scoped Node workflow tests and confirm summary assertion behavior is unchanged
- [x] 3.2 Run scoped Zotero workflow tests and confirm localized summary assertions pass
- [x] 3.3 Verify no regression in workflow failure diagnostics when expected counts are missing
