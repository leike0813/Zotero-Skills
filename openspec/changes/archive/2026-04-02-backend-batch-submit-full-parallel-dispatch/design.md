# Design: backend-batch-submit-full-parallel-dispatch

## 1. Core Decisions

1. Frontend dispatch concurrency is no longer a capacity-control mechanism for
   backend-backed workflows.
2. Backend-backed providers in this change are fixed to:
   - `skillrunner`
   - `generic-http`
3. Local queue orchestration remains in place for:
   - job lifecycle tracking
   - `waitForIdle()` batch completion
   - runtime/task history updates
4. `pass-through` keeps serialized execution because it is a local-only path and
   not governed by backend-side concurrency controls.

## 2. Dispatch Concurrency Contract

A single helper resolves dispatch concurrency from execution context:

- backend-backed provider (`skillrunner`, `generic-http`):
  - concurrency = `requests.length`
- all other providers:
  - concurrency = `1`

The helper is the only place allowed to define this policy.

## 3. Queue Semantics

The queue model does not change:

- FIFO enqueue order remains the local ordering model
- job state machine remains:
  - `queued`
  - `running`
  - `waiting_user`
  - `waiting_auth`
  - `succeeded`
  - `failed`
  - `canceled`

What changes is only the dispatch capacity used by the execution seam.

For backend-backed workflows this means:

- all requests in the batch may leave `queued` almost immediately
- batch completion is still determined by `waitForIdle()`
- apply/summary/toast aggregation continues to happen after the full batch is
  idle

## 4. Test Strategy

Tests are updated in two groups:

1. seam-level policy tests
   - backend-backed workflow batches choose full-parallel dispatch
   - `pass-through` stays serialized
2. queue/progress integration tests
   - existing queue state expectations remain valid
   - tests must stop assuming backend-backed execution is intentionally fixed to
     `concurrency: 1`

## 5. Non-Goals

- no user-configurable frontend concurrency pref
- no provider-side protocol change
- no queue state machine rewrite
- no removal of FIFO/local queue bookkeeping
