# Design: zotero-full-coverage-gate-rebalancing

## Model

The Zotero routine suite keeps the existing two-layer structure:

- `lite`
- `full`

But their responsibilities are clarified:

- `lite` is the daily real-host baseline
- `full` is the stable real-host coverage gate used by CI

The key design change is that `full` is no longer evaluated as
"lite + a few extra parity cases". Instead, it is evaluated against stable
coverage buckets.

## Coverage Buckets

Zotero `full` should cover four real-host risk buckets:

1. `zotero-object-lifecycle`
   - selection context rebuild
   - task runtime persistence/update behavior
   - host item/note/attachment lifecycle interactions

2. `skillrunner-transport-state`
   - request creation
   - deferred / waiting states
   - request-created non-terminal handling
   - restore / history / snapshot / reconcile / deferred completion

3. `workflow-host-context`
   - buildRequest / applyResult
   - host context, idempotency, overwrite, and parent-related guards

4. `ui-host-shell`
   - workflow settings shell
   - preference shell / menu shell
   - run-dialog and waiting-auth host behavior

## Allowlist Strategy

`test/zotero/domainFilter.ts` remains the single allowlist decision point.

- `lite` keeps the existing retained baseline
- `full` extends it with stable suites and suite-title prefixes

The full-only expansion intentionally prefers:

- full-file enablement for stable core suites
- suite-prefix title enablement for mixed `ui` and `workflow` files

This preserves current pruning machinery while making `full` much thicker
without reintroducing brittle interaction paths.

## Non-goals

- No change to Node coverage depth
- No change to runner, bundling, or domain entries
- No reintroduction of editor / picker / dialog / GitHub sync routine tests
