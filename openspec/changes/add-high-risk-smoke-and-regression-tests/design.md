## Context

The project has complex interactions among workflow execution, provider behavior, result application, UI feedback, and Zotero/mock environment differences.  
Some areas have historically produced regressions despite broad test presence, indicating a need for targeted high-risk reinforcement.

## Goals / Non-Goals

**Goals:**

- Build a risk-ranked coverage backlog for smoke and regression tests.
- Add or refine tests for high-risk chains likely to impact user trust.
- Map each reinforcement test to `lite` or `full` suite.
- Document rationale and risk traceability for each added case.

**Non-Goals:**

- Reorganizing full test structure (handled by taxonomy change).
- Redesigning CI policy (handled by suite gate change).
- Refactoring runtime behavior unrelated to coverage gaps.

## Decisions

### Decision 1: Risk-first selection

- Prioritize cases by user impact and historical fragility rather than raw coverage percentage.

### Decision 2: Smoke-first in lite, deep regression in full

- Critical-path smoke cases enter `lite`.
- Long-running or environment-sensitive regressions enter `full`.

### Decision 3: Case-level traceability

- Each added test includes a brief note linking risk source (bug class, boundary, or prior escape).

## Risks / Trade-offs

- [Risk] Added regression tests can increase suite runtime  
  → Mitigation: enforce suite placement and runtime budget checks.

- [Risk] New fixtures can increase maintenance burden  
  → Mitigation: reuse existing fixtures where possible and annotate fixture provenance.

- [Risk] Overfitting to past incidents  
  → Mitigation: include boundary-condition exploration beyond exact historical failures.

