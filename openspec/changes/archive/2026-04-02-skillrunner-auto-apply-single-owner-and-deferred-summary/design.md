# Design: skillrunner-auto-apply-single-owner-and-deferred-summary

## 1. Core Decisions

1. SkillRunner recoverable executions have exactly one `applyResult` owner:
   reconciler.
2. `interactive` already follows this model; `auto` is aligned to the same
   contract.
3. Foreground execution remains responsible for submission, queue drain, and
   initial diagnostics, but not for terminal apply on SkillRunner `auto`.
4. Deferred workflow-completion summary is session-only memory and is not
   restored across plugin restart.
5. Existing terminal double-confirm remains unchanged.

## 2. Execution Mode Contract

Recoverable context gains a new persisted field:

- `executionMode: "auto" | "interactive"`

Resolution order:

1. normalized `request.runtime_options.execution_mode`
2. existing persisted context value
3. fallback `auto`

This field is persisted with the context payload so restart recovery does not
need to re-infer ownership from transient frontend state.

## 3. Foreground Apply Contract

### 3.1 SkillRunner `auto`

If a SkillRunner `auto` job reaches terminal `succeeded` in the foreground queue:

- foreground MUST NOT call `executeApplyResult`
- foreground MUST record it as `reconcile-owned pending`
- foreground MUST log `foreground-apply-skipped-auto`

### 3.2 SkillRunner `interactive`

No change in terminal ownership: reconciler remains the executor.

### 3.3 Non-SkillRunner workflows

No change. Foreground apply continues normally.

## 4. Deferred Completion Tracker

A new session-only tracker keyed by `runId` stores:

- `workflowLabel`
- `totalJobs`
- `skipped`
- initial foreground summary counts (`succeeded`, `failed`, `failureReasons`)
- pending reconcile-owned request set
- deferred job outcomes to emit later
- UI emit context (`win`, `messageFormatter`)

Rules:

1. Tracker is created only when foreground apply ends with one or more
   SkillRunner `auto` jobs deferred to reconciler ownership.
2. Reconciler updates the tracker when each deferred request reaches final
   convergence:
   - `succeeded`: only after apply succeeds
   - `failed/canceled`: immediately on terminal converge
   - `apply-exhausted`: counts as failed with explicit reason
3. When the pending set becomes empty, tracker emits:
   - deferred job toasts
   - one final workflow summary
   - then destroys itself
4. If plugin restarts before completion, tracker is lost intentionally. State
   recovery and apply continue, but summary is not replayed.

## 5. Reconciler Behavior

1. Successful terminal apply still clears context exactly once.
2. If deferred tracker owns the request, reconciler suppresses the old immediate
   terminal toast path and reports the result into the tracker instead.
3. If no tracker owns the request (for example after restart), reconciler keeps
   existing single-job terminal toast behavior.
4. Apply retry semantics remain:
   - success clears retry state/context
   - transient failure retries
   - exhausted retry removes context and reports failed deferred outcome

## 6. SSOT / Invariant Updates

Provider SSOT is tightened with three additional contracts:

1. reconciler owns SkillRunner `auto` apply
2. reconciler owns SkillRunner `interactive` apply
3. foreground apply must skip SkillRunner `auto` terminal success

The YAML invariants and code facts export are updated accordingly so future
ownership drift is CI-blocked.

## 7. Non-Goals

- no change to terminal double-confirm logic
- no persistence of deferred summary tracker
- no change to backend events/chat/jobs protocol
