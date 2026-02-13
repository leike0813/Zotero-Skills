## Context

The project targets a pluggable workflow architecture: core plugin code provides shared protocol/runtime capabilities, while workflow business semantics live in workflow packages.

Current state shows a remaining gray zone: parts of settings domain logic in `src/**` still branch on concrete workflow identity and workflow-specific parameter behavior.
This change operationalizes a strict-but-pragmatic boundary consistent with the selected policy:

- Allowed in core: protocol-level generic concerns (`request kind`, `provider`, `backend profile`, transport/runtime orchestration).
- Disallowed in core: workflow business rules tied to specific workflow ids, field semantics, or domain-specific fallbacks.

## Goals / Non-Goals

**Goals**

- Define an enforceable boundary contract for “core vs workflow business logic”.
- Audit and remediate currently known violations.
- Provide a reusable extension path so workflow-specific setting logic can be implemented without touching core.
- Add tests/checklists to prevent regression.

**Non-Goals**

- Rewriting all workflows.
- Introducing new workflow features unrelated to decoupling.
- Changing user-facing behavior of existing workflow settings.

## Decisions

### Decision 1: Boundary Policy (Option 2) is normative

Core code (`src/**`) may include shared protocol/runtime logic:

- request-kind resolution
- provider/backend/profile selection and merge precedence
- generic schema-driven normalization helpers

Core code must not include:

- branching by concrete workflow id for business behavior
- workflow-specific field semantics (for example, hard-coded handling for one workflow’s custom option)
- workflow-specific fallback policy hardcoded in core modules

### Decision 2: Introduce workflow settings normalizer extension seam

Add a workflow-facing extension seam (resolver/registry) for settings normalization:

- Core calls `resolveWorkflowSettingsNormalizer(workflowId)` (or equivalent) if provided.
- Normalizer executes in workflow-owned surface (workflow package/hooks/adapter contract).
- Core keeps only generic validation pipeline and error handling.

### Decision 3: Migrate known coupling first

First remediation target:

- Remove workflow-id keyed normalization currently present in `workflowSettingsDomain` and move it to workflow extension logic.

Behavior parity is required.

### Decision 4: Enforce with tests + review gate

- Add a targeted test that ensures core normalization path remains workflow-agnostic.
- Add review checklist items in architecture hardening docs/tasks:
  - “No concrete workflow id branching in `src/**`”
  - “Workflow-specific settings semantics implemented via extension seam”

## Risks / Trade-offs

- [Risk] Moving logic out of core may increase indirection.  
  Mitigation: typed extension contracts and clear module naming.

- [Risk] Temporary dual-path behavior while migrating existing workflow-specific logic.  
  Mitigation: migration in one change with parity tests.

- [Risk] Over-enforcement could block legitimate protocol evolution.  
  Mitigation: policy explicitly allows protocol-level logic in core.

## Migration Plan

1. Run boundary audit and list coupling points.
2. Define extension seam contract and adapter wiring.
3. Move currently known workflow-specific normalization from core to extension.
4. Add tests for parity and anti-regression.
5. Document boundary checklist for future code review.

## Acceptance Gates

- Boundary contract documented and test-covered.
- No concrete workflow business rules remain in audited core modules.
- Existing behavior remains unchanged in settings/runtime flows.
- Traceable to architecture hardening baseline and `operationalize-architecture-hardening-baseline`.
