# Design: skillrunner-auto-restart-context-recovery-and-apply

## 1. Core Decisions

1. `auto` and `interactive` share one recoverable-context lifecycle.
2. Context bootstrap trigger is `request-created` (`requestId` ready), not deferred-only.
3. Reconciler remains observer-only for non-terminal state writes.
4. Local managed backend reconcile policy stays unchanged:
   startup skip + post-up reconcile once.
5. Legacy missing-context tasks are handled conservatively:
   state follows backend, apply is skipped with explicit warning.

## 2. Context Lifecycle

### 2.1 Creation / Upsert trigger

At execution seam `onJobProgress(request-created)`:

- write `job.meta.requestId`
- resolve original request by `job.meta.index`
- call reconciler ensure-context API

At `onJobUpdated`:

- call ensure-context again (idempotent upsert) to absorb new metadata.

### 2.2 Required context fields

- `requestId`, `workflowId`, `workflowLabel`, `requestKind`, `request`
- backend identity (`backendId/backendType/backendBaseUrl`)
- provider identity (`providerId`, `providerOptions`)
- run/job/task identity (`runId`, `jobId`, `taskName`, input labels)
- `fetchType` priority:
  1) request `fetch_type`
  2) job result `fetchType`
  3) fallback `bundle`

### 2.3 Idempotent update rules

- same key (`backendId:requestId`) upserts in place
- do not downgrade terminal context state to non-terminal
- preserve existing apply retry fields unless terminal path updates them

## 3. Reconciler Behavior

1. RequestId-driven ensure-context replaces deferred-only register gate.
2. Terminal `succeeded` with valid context executes apply exactly once.
3. Missing-context running candidates:
   - still reconciled for state convergence
   - terminal `succeeded` => no apply, emit warning log + warning toast
   - non-terminal/terminal updates still written to active/history stores.

## 4. SSOT Alignment

Provider SSOT and run workspace SSOT add:

- request-created context bootstrap invariant
- auto/interactive restart parity target
- explicit missing-context terminal branch (`apply skipped` with reason)

## 5. Non-Goals

- no backend protocol changes
- no new DB schema tables
- no startup full reconcile for local managed backend
