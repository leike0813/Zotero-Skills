## Risk Backlog (High + Medium)

This file is the implementation handoff for `add-high-risk-smoke-and-regression-tests`.

### High Risk

| Risk ID | Area | Gap Summary | Evidence Anchor | Target Suite |
|---|---|---|---|---|
| HR-01 | `backendManager` | Validation/persistence branches have no dedicated tests | `src/modules/backendManager.ts` | `lite` smoke + `full` regression |
| HR-02 | `workflowExecution/applySeam` | Missing direct assertions for `job missing`, `target parent unresolved`, `requestId missing` | `src/modules/workflowExecution/applySeam.ts` | `lite` |
| HR-03 | `declarativeRequestCompiler` | Guardrail errors lack explicit negative tests | `src/workflows/declarativeRequestCompiler.ts` | `lite` |

### Medium Risk

| Risk ID | Area | Gap Summary | Evidence Anchor | Target Suite |
|---|---|---|---|---|
| MR-01 | `loader` normalize hook diagnostics | Missing targeted tests for `normalizeSettings` hook diagnostics | `src/workflows/loader.ts` | `lite` |
| MR-02 | `lite/full` governance enforcement | Policy exists but enforceability checks are weak | `doc/components/test-suite-governance.md`, `openspec/specs/test-suite-gating-strategy/spec.md` | `lite` |
| MR-03 | Utility UI/diagnostic flows | `taskManagerDialog` and `selectionSample` low direct coverage | `src/modules/taskManagerDialog.ts`, `src/modules/selectionSample.ts` | `full` (with selective `lite` smoke if cheap) |

### Traceability Rule

Each new reinforcement test should include one of:

- test name suffix/prefix with risk ID, or
- nearby comment line: `Risk: HR-xx` / `Risk: MR-xx`, or
- mapping entry in implementation notes that links test path to risk ID.

### Implemented Coverage Anchors

| Risk ID | Added/Updated Test Anchors | Suite |
|---|---|---|
| HR-01 | `test/core/57-backend-manager-risk-regression.test.ts` | `lite` |
| HR-02 | `test/core/55-workflow-apply-seam-risk-regression.test.ts` | `lite` |
| HR-03 | `test/core/56-declarative-request-compiler-guards.test.ts` | `lite` |
| MR-01 | `test/core/20-workflow-loader-validation.test.ts` (`normalizeSettings` diagnostics cases) | `lite` |
| MR-02 | `test/core/58-suite-governance-constraints.test.ts` | `lite` |
| MR-03 | `test/core/59-selection-sample-risk-regression.test.ts` | `lite` |
