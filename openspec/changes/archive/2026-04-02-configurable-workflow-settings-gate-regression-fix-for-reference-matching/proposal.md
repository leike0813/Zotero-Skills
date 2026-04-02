# Change: configurable-workflow-settings-gate-regression-fix-for-reference-matching

## Why

`reference-matching` is currently the only builtin workflow that consistently
exercises the configurable pass-through trigger path:

- context-menu click
- pre-submit settings gate
- web settings dialog
- confirm
- pass-through execution
- `applyResult`

The workflow core itself still works in node/mock tests, but real runtime
triggering can fail silently. The current menu handler fires
`executeWorkflowFromCurrentSelection()` without any top-level guard, and the
settings-gate/dialog path has almost no end-to-end coverage. If dialog creation
or gate setup throws, the user sees "nothing happened".

This change restores actual usability for `reference-matching` and removes the
same silent-failure class for every configurable workflow.

## What Changes

1. Add an explicit guarded trigger entry for configurable workflow menu actions.
2. Make settings-gate failures observable through runtime logs and user-facing
   feedback instead of silent no-op behavior.
3. Harden the workflow settings web dialog opening path for configurable
   pass-through workflows.
4. Record workflow source diagnostics so builtin-vs-user override can be seen in
   trigger-failure logs.
5. Add regression tests for configurable workflow menu trigger and gate failure
   behavior.

## Impact

- No workflow protocol or note payload change.
- `reference-matching` and other configurable workflows become diagnosable when
  settings-gate opening fails.
- Context-menu trigger behavior changes from silent failure to explicit failure
  handling.
