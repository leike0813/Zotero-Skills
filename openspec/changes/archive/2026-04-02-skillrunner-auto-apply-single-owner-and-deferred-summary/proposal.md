# Change: skillrunner-auto-apply-single-owner-and-deferred-summary

## Why

SkillRunner `auto` mode currently allows two near-concurrent terminal apply paths
for the same request:

- foreground chain: `idlePromise -> runWorkflowApplySeam -> executeApplyResult`
- reconciler chain: `terminal double-confirm -> applyTerminalSuccessContext`

Because recoverable context is already created at `request-created`, foreground
apply does not remove that context before the reconciler runs again. This leaves
the reconciler free to hit the same `applyResult` a second time within a very
small window.

The result is a real duplicate-apply risk that can exceed workflow-level
idempotence assumptions.

## What Changes

1. Make reconciler the single `applyResult` owner for all recoverable SkillRunner
   executions, including both `auto` and `interactive`.
2. Add explicit `executionMode` to recoverable SkillRunner context so foreground
   and reconciler paths consume the same mode fact.
3. Skip real foreground apply for SkillRunner `auto` terminal success and mark it
   as reconciler-owned pending instead.
4. Defer SkillRunner `auto` completion summary/job toasts to reconciler
   convergence and keep that deferred summary tracker session-scoped only.
5. Keep restart recovery and apply retry semantics unchanged except for the new
   single-owner contract.

## Impact

- No backend protocol change.
- No external event/API name change.
- Internal SkillRunner apply ownership changes:
  - foreground no longer applies `auto` terminal success
  - reconciler becomes the only terminal apply executor
- `auto` workflow completion summary timing changes from immediate foreground
  completion to reconciler-owned deferred completion within the same plugin
  session.
