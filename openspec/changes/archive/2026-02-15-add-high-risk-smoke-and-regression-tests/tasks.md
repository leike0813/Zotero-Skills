## 1. Risk Backlog and Coverage Mapping

- [x] 1.1 Create `risk-backlog.md` with explicit `HR-01..HR-03` and `MR-01..MR-03` entries
- [x] 1.2 Map each risk entry to current coverage evidence and uncovered branches
- [x] 1.3 Define target suite placement (`lite`/`full`) for each risk entry

## 2. High-Risk Reinforcement (HR)

- [x] 2.1 Add regression tests for `HR-01` (`backendManager`) covering validation and persistence failures
- [x] 2.2 Add seam-level tests for `HR-02` (`applySeam`) covering `job missing`, `target parent unresolved`, and `requestId missing`
- [x] 2.3 Add compiler tests for `HR-03` (`declarativeRequestCompiler`) covering selector cardinality, duplicate upload key, and missing steps guards
- [x] 2.4 Ensure at least one fast smoke case per `HR-*` entry is runnable in `lite`

## 3. Medium-Risk Reinforcement (MR)

- [x] 3.1 Add loader tests for `MR-01` covering `normalizeSettings` missing file/import/export diagnostics
- [x] 3.2 Add governance checks for `MR-02` to keep `lite/full` constraints auditable in tests or gate scripts
- [x] 3.3 Add targeted utility tests for `MR-03` (`taskManagerDialog` and/or `selectionSample`) for critical non-happy paths

## 4. Traceability and Validation

- [x] 4.1 Add risk traceability markers (`Risk: HR-xx/MR-xx`) to each added reinforcement test or mapping note
- [x] 4.2 Run scoped Node suites (`core`, `ui`, `workflow`) and confirm no gate regressions
- [x] 4.3 Run scoped Zotero suites for touched domains and confirm parity on summary/diagnostic behavior
