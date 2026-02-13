## Context

The project has completed M3 and accumulated a large set of workflows, hooks, providers, UI features, and test cases.  
The next phase (M4) needs faster feature delivery while keeping runtime behavior stable across Zotero real environment and Node/mock environment.  
Recent iterations also showed that:

- test inventory has grown without clear suite boundaries,
- change-level traceability is strong, but release-level quality gates need clearer defaults,
- new workflows (especially backend-coupled ones) increase integration risk unless architecture and testing are hardened first.

This design defines a planning framework only. It does not introduce runtime or code changes directly.

## Goals / Non-Goals

**Goals:**

- Define a weekly M3-to-M4 roadmap with explicit dependency order.
- Require architecture hardening before new business workflow expansion.
- Define a test-governance baseline:
  - grouped test taxonomy,
  - `lite` and `full` suite strategy by depth/scope,
  - CI policy: PR executes `lite`, release executes `full`.
- Define developer enablement planning outputs:
  - workflow + AutoSkill development guide,
  - helper Skill for guided workflow/skill package creation.
- Define planning boundaries for Tag capability expansion:
  - controlled vocabulary manager (`tag-manager`),
  - backend normalization workflow (`tag-regulator`).
- Define M4 Definition of Done (DoD) and phase exit criteria.

**Non-Goals:**

- Implementing refactors, tests, or new workflows in this change.
- Modifying existing runtime behavior, API contracts, or UI.
- Replacing existing specs with implementation-level details.

## Decisions

### Decision 1: Weekly roadmap as the planning unit

- Chosen: weekly milestones.
- Why: user explicitly requested weekly planning and this format improves short feedback loops.
- Alternative considered:
  - Phase-only planning (M3.1/M3.2/...): clearer at high level but weaker for tracking execution cadence.

### Decision 2: Hardening-first sequencing

- Chosen: Track A (architecture + test governance) must precede business feature expansion.
- Why: the current risk profile is dominated by complexity and regression probability.
- Alternative considered:
  - Parallel feature-first path: faster visible output but higher stability risk and rework cost.

### Decision 3: Two-tier quality gates

- Chosen: `lite` suite for PR gating, `full` suite for release gating.
- Why: balances delivery speed and confidence at release boundary.
- Alternative considered:
  - Run full suite on every PR: strongest safety but low throughput and high CI latency.

### Decision 4: Planning artifact depth remains macro-level

- Chosen: roadmap + milestones + acceptance criteria only.
- Why: user explicitly selected macro depth (`A`), and implementation details will be tracked in dedicated follow-up changes.
- Alternative considered:
  - interface-level drafts now: more detailed upfront, but would prematurely lock implementation.

### Decision 5: Explicit governance add-ons included in roadmap scope

- Chosen: include versioning policy, backend security/config guidance, and DoD metrics in the roadmap.
- Why: these are cross-cutting quality controls that reduce downstream ambiguity.
- Alternative considered:
  - defer governance topics to later changes: risks fragmented standards and inconsistent implementation quality.

## Risks / Trade-offs

- [Risk] Weekly plan may drift as new urgent bugs appear.  
  → Mitigation: define re-planning checkpoints and maintain a strict hardening completion gate before Track C.

- [Risk] Lite/full split may hide integration defects until release window.  
  → Mitigation: include mandatory smoke integration set inside `lite` and enforce release dry-run before tagging.

- [Risk] Documentation and guideline work can expand in scope and delay workflow delivery.  
  → Mitigation: define clear “guide MVP” acceptance criteria and postpone advanced examples to follow-up changes.

- [Risk] Tag system design may become over-engineered before validating user workflows.  
  → Mitigation: keep initial scope focused on controlled vocabulary lifecycle and regulator loop; defer advanced analytics.

## Migration Plan

1. Approve this roadmap change as planning baseline.
2. Open follow-up implementation changes per milestone cluster:
   - test taxonomy/suite restructuring,
   - documentation and helper Skill,
   - tag-manager and tag-regulator workflows.
3. Track progress through change-level tasks and weekly checkpoints.
4. Use M4 DoD criteria as final release readiness gate.

Rollback strategy: if roadmap direction becomes invalid, archive or supersede this change with a revised planning change without touching runtime code.

## Open Questions

- Exact week count and calendar mapping to release target date.
- Final threshold values for M4 DoD metrics (coverage targets, flakiness rate, regression budget).
- Prioritization between helper Skill sophistication and first Tag workflow delivery after Track A completion.
