# Design

## Core Approach

Introduce a cross-realm workflow execution capability bridge backed by the existing `__zsWorkflowRuntimeBridge` global bridge.

For each hook execution:

1. Core runtime builds a capability snapshot.
2. Core runtime registers the snapshot in the bridge and receives a token.
3. Core runtime injects `workflowExecutionToken` into the hook runtime object.
4. Package-local runtime accessors resolve the current capability snapshot from the token.
5. Core runtime releases the token after hook completion.

This keeps the standard package execution model to:

- `resource-loaded module`
- `execution token`
- `capability bridge`

## Snapshot Shape

The snapshot contains:

- `zotero`
- `addon`
- `handlers`
- `helpers`
- `fetch`
- `Buffer`
- `btoa` / `atob`
- `TextEncoder` / `TextDecoder`
- `FileReader`
- `navigator`
- `debugMode`
- `workflowId`
- `packageId`
- `workflowSourceKind`
- `hookName`

## Compatibility

- Package workflows use bridge-first capability resolution.
- Legacy workflows still receive the direct runtime object and may continue using the legacy execution scope fallback.
- `globalThis` and direct runtime-object inspection remain as compatibility fallbacks only.

## Diagnostics

Diagnostics add bridge-specific fields:

- `hasExecutionToken`
- `bridgeResolved`
- `bridgeToken`
- `capabilitySource`

These fields must appear in:

- hook execution diagnostics
- package runtime accessor diagnostics
- debug probe results
