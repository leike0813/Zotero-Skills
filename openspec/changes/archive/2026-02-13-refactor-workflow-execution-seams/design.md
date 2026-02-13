## Context

Execution orchestration currently spans multiple concerns in `workflowExecute.ts`, with tightly coupled logic for:
- selection validation and request build,
- provider queue lifecycle,
- applyResult and bundle handling,
- status/toast/message rendering,
- runtime logging.

This coupling increases change risk and makes localized testing harder.  
The refactor must preserve behavior while exposing explicit seams for future hardening work.

## Goals / Non-Goals

**Goals:**

- Split execution logic into seam-focused modules with explicit contracts.
- Preserve current observable behavior and failure semantics.
- Improve testability via seam-level dependency injection and smaller units.
- Keep migration incremental and reversible.

**Non-Goals:**

- Changing workflow business behavior.
- Changing provider contracts or workflow manifest formats.
- Introducing new UI features in this change.

## Decisions

### Decision 1: Seam-oriented orchestration decomposition

Execution flow is decomposed into modules:

- `ExecutionPreparationSeam`: selection -> execution context -> requests -> skip stats.
- `ExecutionRunSeam`: queue enqueue/drain and provider execution lifecycle.
- `ExecutionApplySeam`: per-job result application and bundle reader lifecycle.
- `ExecutionFeedbackSeam`: start/job/finish notifications and summary messages.

This keeps each stage independently testable and reduces large-function risk.

### Decision 2: Behavior-preserving public entrypoint

`executeWorkflowFromCurrentSelection` remains the external entrypoint, but delegates to seam modules.  
This avoids API breakage while enabling internal structure hardening.

### Decision 3: Standardized seam handoff contract

Introduce explicit handoff objects between seams (request list, skip counts, run metadata, per-job outcomes) to remove hidden state coupling.

### Decision 4: Dependency injection at seam boundaries

Side-effectful operations (alerts/toasts, file I/O, provider invocation, log append) are passed via seam dependencies to improve determinism and testability.

## Risks / Trade-offs

- [Risk] Refactor may subtly alter summary/skip semantics  
  → Mitigation: add parity tests around succeeded/failed/skipped counts and message output.

- [Risk] More modules can increase indirection cost for small fixes  
  → Mitigation: enforce clear module responsibility docs and stable seam contracts.

- [Risk] Incomplete extraction leaves hidden coupling  
  → Mitigation: require each extracted seam to own explicit input/output types and no cross-stage hidden mutation.

## Migration Plan

1. Extract seam contracts and helper types without behavior changes.
2. Move preparation/run/apply/feedback logic into dedicated modules incrementally.
3. Keep entrypoint compatibility and run parity tests after each extraction step.
4. Remove obsolete glue code after parity verification.

Rollback:
- if parity breaks, revert seam extraction chunk-by-chunk while keeping entrypoint intact.

## Open Questions

- None for planning phase; implementation-level trade-offs will be resolved within this change tasks.

