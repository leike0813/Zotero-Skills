# workflow-package-bridge-carrier-move-off-globalthis

## Summary

Move the workflow-package execution snapshot carrier off `globalThis.__zsWorkflowRuntimeBridge` and make `addon.data.workflowRuntimeBridge` the standard bridge host for package `.mjs` runtime capability resolution in Zotero.

## Why

Real Zotero probe results show that `workflowExecutionToken` reaches package hooks, but `bridgeResolved` remains false. This means token injection works while the bridge carrier remains realm-local and cannot reliably share the registry between the main bundle and `resource://` package modules.

## What Changes

- Make `addon.data.workflowRuntimeBridge` the canonical execution snapshot carrier.
- Keep `globalThis.__zsWorkflowRuntimeBridge` as a compatibility mirror only.
- Update package runtime accessors to resolve bridge state from addon data first.
- Extend diagnostics with `bridgeCarrier`.

