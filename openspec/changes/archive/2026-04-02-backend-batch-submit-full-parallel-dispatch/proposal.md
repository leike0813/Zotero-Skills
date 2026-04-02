# Change: backend-batch-submit-full-parallel-dispatch

## Why

Batch workflow submission currently still uses the initial serialized dispatch
policy at the execution seam. The local queue hard-codes `concurrency: 1`, so
backend-backed requests are dispatched one by one even when the backend itself
already owns concurrency, queueing, and overload control.

This creates unnecessary frontend throttling and makes bulk submission slower
than the actual backend contract requires.

## What Changes

1. Remove frontend concurrency limiting for backend-backed workflow batches.
2. Keep the local queue and `queued/running/terminal` model, but stop using it
   as a capacity governor for backend-backed providers.
3. Introduce one explicit dispatch-concurrency decision helper that treats
   `skillrunner` and `generic-http` as fully parallel backend-backed providers.
4. Keep `pass-through` and other local-only execution paths on the current
   serialized behavior.
5. Update execution seam docs/specs/tests so the new contract is explicit and
   guarded.

## Impact

- No external API or workflow protocol change.
- Backend-backed workflow batches now dispatch all requests immediately from the
  frontend side.
- Queue status semantics remain intact, but `queued` becomes a very short-lived
  local transition for backend-backed batches.
