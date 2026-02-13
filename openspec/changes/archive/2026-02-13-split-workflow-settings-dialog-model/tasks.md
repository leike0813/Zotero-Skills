## 1. Render-Model Contract Extraction

- [x] 1.1 Define typed dialog render-model contracts for workflow settings sections/fields/actions
- [x] 1.2 Extract pure model builder(s) from `workflowSettingsDialog.ts` using manifest schema + domain initial state
- [x] 1.3 Ensure model composition is deterministic and free of persistence side effects

## 2. Dialog Host Refactor

- [x] 2.1 Refactor `workflowSettingsDialog.ts` to render from model descriptors instead of inline schema assembly
- [x] 2.2 Extract and centralize draft collection/serialization logic for save/apply actions
- [x] 2.3 Remove duplicated model/data wiring branches from dialog layer

## 3. Regression Coverage and Parity

- [x] 3.1 Add/refresh tests for model composition and draft serialization behavior
- [x] 3.2 Keep existing workflow settings integration tests passing without behavior drift
- [x] 3.3 Validate impacted node/zotero suites for parity

## 4. Hardening Gate Closure

- [x] 4.1 Confirm no UX drift in workflow settings dialog interactions
- [x] 4.2 Confirm readability improvement (clear model-vs-render boundary)
- [x] 4.3 Record traceability to baseline item `HB-05`
