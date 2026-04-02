# Design: configurable-workflow-settings-gate-regression-fix-for-reference-matching

## 1. Core Decisions

1. Treat this as a configurable-workflow trigger regression, not as a
   `reference-matching`-specific business logic issue.
2. Keep workflow business logic, parameter schema, and pass-through execution
   semantics unchanged.
3. Fix the trigger chain in two places:
   - guarded async menu dispatch
   - settings-gate/web-dialog error propagation
4. Add workflow-source diagnostics so duplicate user overrides can be separated
   from builtin workflow regressions.

## 2. Trigger Chain Contract

For configurable workflows, trigger flow remains:

- menu click
- settings gate
- dialog confirm/cancel
- execution

What changes is failure handling:

- user cancel remains a normal non-error exit
- settings-gate/dialog failure becomes a structured failure result
- menu trigger must surface that failure through runtime logs and user-facing
  feedback

Silent failure is no longer allowed.

## 3. Settings Dialog Hardening

The web dialog stays the primary path.

The opening routine must:

- construct the dialog in a way that guarantees the helper handle is available
  when load callbacks run
- convert dialog initialization failures into `{ status: "error" }` results
  instead of uncaught exceptions
- preserve current `confirmed` and `canceled` result semantics

This change does not redesign the dialog UI or alter schema handling.

## 4. Diagnostics

Trigger failure logs must include:

- `workflowId`
- `providerId`
- `workflowSource` (`builtin` or `user`)
- stage-specific reason

This allows future diagnosis when a user workflow overrides builtin
`reference-matching`.

## 5. Test Strategy

Tests are added in two layers:

1. execution seam / trigger tests
   - configurable workflow gate failures must not silent-fail
   - runtime log + alert feedback must be emitted
2. static routing guard
   - workflow menu must use a guarded async trigger entry instead of bare
     fire-and-forget execution
