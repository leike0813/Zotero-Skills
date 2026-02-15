## 1. Scope Reset and Artifact Cleanup

- [x] 1.1 Reset this change scope to baseline-only reassessment (`doc/architecture-hardening-baseline.md`)
- [x] 1.2 Remove overscoped interim outputs created in the change directory
- [x] 1.3 Revert unrelated roadmap-linkage edits introduced by the overscoped implementation

## 2. Baseline-Constrained Reassessment Execution

- [x] 2.1 Define baseline-only comparison dimensions using `D-*`, `HB-*`, and acceptance checklist as source set
- [x] 2.2 Build a normalized residual risk register with mandatory fields and explicit evidence pointers
- [x] 2.3 Re-validate previously mitigated baseline items and record no-regression outcomes

## 3. Documentation Publication

- [x] 3.1 Publish reassessment report to `doc/architecture-hardening-baseline-reassessment.md`
- [x] 3.2 Add a clear cross-reference from `doc/architecture-hardening-baseline.md` to the reassessment report
- [x] 3.3 Ensure report contains scope statement, rubric, risk entries, closure states, and out-of-scope note

## 4. Validation and Completion

- [x] 4.1 Run `openspec validate reassess-architecture-residual-risks`
- [x] 4.2 Run type check (`npx tsc --noEmit`)
- [x] 4.3 Mark tasks complete and confirm change is apply-ready
