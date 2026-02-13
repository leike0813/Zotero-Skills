## 1. Week 1 - Architecture Baseline and Debt Audit

- [ ] 1.1 Build an architecture inventory for runtime pipeline, provider layer, workflow hooks, and editor host boundaries
- [ ] 1.2 Identify technical debt candidates and classify by risk (stability, maintainability, testability)
- [ ] 1.3 Produce a prioritized hardening backlog with explicit sequencing constraints
- [ ] 1.4 Define refactor acceptance criteria (no behavior change, test parity, readability delta)

## 2. Week 2 - Test Taxonomy and Suite Strategy

- [ ] 2.1 Regroup existing tests into `core`, `ui`, and `workflow-*` domains
- [ ] 2.2 Define `lite` suite scope for PR gating and `full` suite scope for release gating
- [ ] 2.3 Define suite depth rules (smoke/integration/e2e boundaries) and ownership model
- [ ] 2.4 Draft CI gate policy and failure severity policy (blocking vs non-blocking)

## 3. Week 3 - Coverage Gaps and Reviewability Plan

- [ ] 3.1 Perform coverage gap analysis by module and by high-risk workflow paths
- [ ] 3.2 Define missing test backlog with priority and target suite (`lite` or `full`)
- [ ] 3.3 Define code readability plan (critical comments, naming normalization, module responsibilities)
- [ ] 3.4 Define test readability plan (case intent notes, fixture provenance, reviewer checklist)

## 4. Week 4 - Developer Enablement Planning

- [ ] 4.1 Draft outline for Workflow + AutoSkill development guide (from scaffold to verification)
- [ ] 4.2 Define guide MVP scope, examples, and non-goals for first release
- [ ] 4.3 Define helper Skill product boundary (inputs, outputs, and interaction flow)
- [ ] 4.4 Split helper Skill implementation into follow-up changes with dependency mapping

## 5. Week 5 - Tag Capability Planning

- [ ] 5.1 Draft `tag-manager` workflow plan (controlled vocabulary CRUD/import/export/audit trail)
- [ ] 5.2 Draft `tag-regulator` workflow plan (backend invocation, add/remove/suggested-tag handling)
- [ ] 5.3 Define traceability model between vocabulary evolution and regulator suggestions
- [ ] 5.4 Split Tag implementation into staged follow-up changes (foundation, MVP, hardening)

## 6. Week 6 - Governance, DoD, and M4 Entry Gate

- [ ] 6.1 Define workflow contract/versioning policy for backward-compatible evolution
- [ ] 6.2 Define backend config/security baseline (token handling, log redaction, environment migration)
- [ ] 6.3 Define measurable M4 DoD metrics and release entry/exit criteria
- [ ] 6.4 Produce final M3-to-M4 roadmap package and approval checklist
