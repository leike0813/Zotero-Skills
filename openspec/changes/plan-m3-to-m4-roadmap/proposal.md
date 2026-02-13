## Why

The project has reached M3 and is ready for broader feature expansion, but current complexity and test surface area create delivery risk for M4.  
Before adding more workflows, we need a unified plan that stabilizes architecture, restructures testing strategy, and sets execution order with measurable milestones.

## What Changes

- Define an M3-to-M4 weekly roadmap focused on architecture hardening first, then feature expansion.
- Establish a test governance strategy:
  - regroup tests by domain (core, UI, workflow-specific),
  - define `lite` and `full` suites by depth and scope,
  - set CI policy: PR runs `lite`, release runs `full`.
- Define technical debt and refactor planning outputs, including readability and reviewability improvements.
- Define developer enablement deliverables:
  - workflow + skill-runner AutoSkill development guide,
  - a helper Skill to assist users in building end-to-end workflow + skill packages.
- Define tag-system roadmap deliverables:
  - `tag-manager` workflow for controlled vocabulary lifecycle and traceability,
  - `tag-regulator` workflow integration with backend skill for normalization and vocabulary growth.
- Add cross-cutting roadmap governance items:
  - compatibility/versioning policy for workflow contracts,
  - backend configuration and security guidance,
  - M4 Definition of Done (DoD) and phase exit criteria.

## Capabilities

### New Capabilities

- `m3-m4-roadmap-planning`: A planning capability that defines weekly milestones, governance rules, validation criteria, and execution order for M4 preparation and delivery.

### Modified Capabilities

- None.

## Impact

- Affects planning artifacts under `openspec/changes/` and spec governance under `openspec/specs/`.
- No runtime behavior or code implementation is changed in this change.
- Downstream implementation changes will be split into separate, focused changes after this roadmap is approved.
