## 1. Baseline Interpretation Framework

- [x] 1.1 Define and document the standardized method to interpret HB items into executable change scope
- [x] 1.2 Define decomposition rules (single primary HB owner per change, split conditions, traceability rules)
- [x] 1.3 Define acceptance-gate inheritance template for downstream hardening changes

## 2. HB-to-Change Operational Mapping

- [x] 2.1 Build explicit HB-01..HB-09 mapping matrix with reuse/new-open classification
- [x] 2.2 Mark existing in-progress changes as reused carriers where coverage is valid (HB-07/HB-08/HB-09)
- [x] 2.3 Define residual scope for partially covered HB items and assign dedicated new changes

## 3. Execution Wave and Portfolio Finalization

- [x] 3.1 Define dependency-aware execution waves and parallelism constraints
- [x] 3.2 Enumerate missing hardening changes to open next:
- [x] 3.3 `refactor-workflow-execution-seams`
- [x] 3.4 `harden-workflow-loader-contracts`
- [x] 3.5 `normalize-provider-request-contracts`
- [x] 3.6 `decouple-workflow-settings-domain`
- [x] 3.7 `split-workflow-settings-dialog-model`
- [ ] 3.8 `consolidate-runtime-global-bridges`
- [ ] 3.9 `govern-zotero-mock-parity`
- [ ] 3.10 Publish final operational portfolio summary and handoff criteria
