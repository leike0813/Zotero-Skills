## 1. Suite Definition

- [x] 1.1 Define objective inclusion criteria for `lite` and `full`
- [x] 1.2 Produce suite membership list aligned with domain taxonomy
- [x] 1.3 Validate that `full` is a strict superset of `lite`
- [x] 1.4 Analyze current `lite` suite and identify cases that can be moved to `full` without reducing PR critical-path protection
- [x] 1.5 Create a dedicated selection-context fixture derived from the first three parents of `selection-context-mix-all` (exclude standalone notes)
- [x] 1.6 Update `selection-context rebuild` lite behavior to run only the top-3-parent fixture and keep rebuilt artifacts (no cleanup)

## 2. Script and CI Wiring

- [x] 2.1 Add deterministic npm scripts for `test:lite` and `test:full`
- [x] 2.2 Wire PR pipeline to `test:lite` and release pipeline to `test:full`
- [x] 2.3 Add gate result reporting with explicit blocking semantics
- [x] 2.4 Add first-level domain grouped commands for Node (`core`, `ui`, `workflow`)
- [x] 2.5 Add first-level domain grouped commands for Zotero (`core`, `ui`, `workflow`)
- [x] 2.6 Verify grouped commands do not expose per-workflow command variants in this change

## 3. Governance and Validation

- [x] 3.1 Define failure severity policy (blocking vs warning) in docs
- [x] 3.2 Run dry-run verification for PR and release gate paths
- [x] 3.3 Publish suite governance notes for future test additions
- [x] 3.4 Document lite-pruning rationale and moved-case inventory for auditability
