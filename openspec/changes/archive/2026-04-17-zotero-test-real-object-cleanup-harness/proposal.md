# zotero-test-real-object-cleanup-harness

## Why

Real Zotero tests currently clean background async state after each test, but
they do not uniformly clean real Zotero library objects created during the test
itself. Long-running `zotero:full` runs therefore accumulate parent items,
notes, attachments, and collections inside the real Zotero DB, which increases
selection/build/apply cost late in the run and amplifies flaky tail-end
timeouts.

## What Changes

- add a global real-host object cleanup harness at the `test/` layer
- track objects created through `handlers` and best-effort delete them after
  each real Zotero test
- provide explicit registration APIs for the small number of tests that create
  real Zotero objects directly
- wire object cleanup into the shared Zotero teardown after background cleanup
- document the contract in test governance docs and OpenSpec

## Impact

- real Zotero tests stop leaking DB objects across test boundaries
- `zotero:full` tail-end workflow timeouts should shrink without changing
  workflow business logic
- no production code paths or Zotero object prototypes are modified
