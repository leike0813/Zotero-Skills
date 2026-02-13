## 1. Suite Definition

- [ ] 1.1 Define objective inclusion criteria for `lite` and `full`
- [ ] 1.2 Produce suite membership list aligned with domain taxonomy
- [ ] 1.3 Validate that `full` is a strict superset of `lite`

## 2. Script and CI Wiring

- [ ] 2.1 Add deterministic npm scripts for `test:lite` and `test:full`
- [ ] 2.2 Wire PR pipeline to `test:lite` and release pipeline to `test:full`
- [ ] 2.3 Add gate result reporting with explicit blocking semantics

## 3. Governance and Validation

- [ ] 3.1 Define failure severity policy (blocking vs warning) in docs
- [ ] 3.2 Run dry-run verification for PR and release gate paths
- [ ] 3.3 Publish suite governance notes for future test additions

