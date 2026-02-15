## Context

`doc/architecture-hardening-baseline.md` was the pre-refactor architecture audit output for M3->M4 transition.  
After a wave of hardening changes, we now need a constrained reassessment that checks only the baseline-defined concerns and reports what residual risk remains.

This reassessment is documentation-governance work, not runtime implementation work.

## Goals / Non-Goals

**Goals:**

- Reassess baseline debt and boundary items using current evidence.
- Produce one baseline-focused residual risk report with explicit scoring rules.
- Keep a clean trace from baseline -> reassessment via documentation linkage.

**Non-Goals:**

- No expansion into unrelated roadmap planning.
- No dependency mapping to not-yet-implemented future changes.
- No runtime behavior changes.

## Decisions

### Decision 1: Baseline-only scope gate

- Choice: only assess items explicitly defined in `doc/architecture-hardening-baseline.md` (`D-*`, `HB-*`, acceptance checklist dimensions).
- Why: prevents boundary drift and keeps this change aligned with requested intent.
- Alternative considered: include emerging risks from all active roadmap work.
  - Rejected because it mixes reassessment with future planning.

### Decision 2: Report output lives under `doc/`

- Choice: publish reassessment as a project document (`doc/architecture-hardening-baseline-reassessment.md`) and keep change directory for OpenSpec artifacts only.
- Why: reassessment is a governance artifact intended for long-term reading, not transient change-internal notes.
- Alternative considered: keep operational outputs only inside `openspec/changes/...`.
  - Rejected as less discoverable for future architecture reviews.

### Decision 3: Normalized risk schema with explicit rubric

- Choice: each risk entry uses fixed fields and a deterministic severity rubric.
- Why: ensures repeatability and auditability across review cycles.
- Alternative considered: narrative-only reassessment.
  - Rejected due to weak comparability.

### Decision 4: Revalidation required for mitigated items

- Choice: items believed mitigated must still include no-regression evidence in reassessment.
- Why: avoids false closure after refactor waves.
- Alternative considered: trust previous closure without re-check.
  - Rejected due to regression risk.

## Risks / Trade-offs

- [Risk] Scope becomes too narrow and misses new non-baseline risks  
  -> Mitigation: explicitly mark out-of-scope findings as candidates for separate future changes.

- [Risk] Evidence quality differs across baseline items  
  -> Mitigation: require at least one concrete code/test/doc pointer per risk decision.

- [Risk] Severity assignment disagreements  
  -> Mitigation: use a documented rubric and include per-item scoring rationale.

## Migration Plan

1. Remove/replace overscoped reassessment artifacts from this change.
2. Produce baseline-only reassessment report in `doc/`.
3. Add baseline document linkage to reassessment report.
4. Mark tasks complete and validate change.

## Open Questions

- Should the next reassessment cycle use the same rubric unchanged, or allow rubric versioning in the document header?
