## Context

The project has complex interactions among workflow execution, provider behavior, result application, UI feedback, and Zotero/mock environment differences.  
Some areas have historically produced regressions despite broad test presence, indicating a need for targeted high-risk reinforcement.

Recent gap analysis identified concrete weak points:

- `src/modules/backendManager.ts`: critical configuration validation and persistence path lacks dedicated tests.
- `src/modules/workflowExecution/applySeam.ts`: several error-path branches are implemented but not explicitly asserted.
- `src/workflows/declarativeRequestCompiler.ts`: negative request-shape guardrails need direct coverage.
- `src/workflows/loader.ts` (`normalizeSettings` hook path): diagnostics branches need targeted tests.
- `lite/full` governance: policy exists, but enforcement checks are weak.
- `src/modules/taskManagerDialog.ts` and `src/modules/selectionSample.ts`: utility UI/diagnostic paths have low direct coverage.

## Goals / Non-Goals

**Goals:**

- Build a risk-ranked coverage backlog with stable IDs and file-level anchors.
- Add or refine tests for high-risk chains likely to impact user trust.
- Add medium-risk guardrail tests where current policy/utility paths are weak.
- Map each reinforcement test to `lite` or `full` suite.
- Document rationale and risk traceability for each added case.

**Non-Goals:**

- Reorganizing full test structure (handled by taxonomy change).
- Redesigning CI policy (handled by suite gate change).
- Refactoring runtime behavior unrelated to coverage gaps.

## Decisions

### Decision 1: Risk-first selection

- Prioritize cases by user impact and historical fragility rather than raw coverage percentage.

### Decision 2: Use explicit risk IDs with test anchors

- High-risk IDs:
  - `HR-01`: backend manager config validation/persistence.
  - `HR-02`: workflow apply seam error branches.
  - `HR-03`: declarative request compiler guardrails.
- Medium-risk IDs:
  - `MR-01`: loader `normalizeSettings` diagnostic branches.
  - `MR-02`: suite governance enforcement (`lite/full` auditable constraints).
  - `MR-03`: utility UI/diagnostic flows (`taskManagerDialog`, `selectionSample`).

### Decision 3: Smoke-first in lite, deep regression in full

- Critical-path smoke cases enter `lite`.
- Long-running or environment-sensitive regressions enter `full`.

### Decision 4: Case-level traceability is mandatory for reinforcement tests

- Each added/updated reinforcement test includes risk traceability (`Risk: HR-xx/MR-xx`) in test name, comments, or companion mapping table.
- Risk-to-test mapping is maintained in change-local backlog artifact for review and implementation handoff.

## Risks / Trade-offs

- [Risk] Added regression tests can increase suite runtime  
  → Mitigation: enforce suite placement and runtime budget checks.

- [Risk] New fixtures can increase maintenance burden  
  → Mitigation: reuse existing fixtures where possible and annotate fixture provenance.

- [Risk] Overfitting to past incidents  
  → Mitigation: include boundary-condition exploration beyond exact historical failures.

- [Risk] Medium-risk scope creep can dilute high-risk reinforcement work  
  → Mitigation: prioritize `HR-*` first and keep `MR-*` to minimal guardrail coverage.
