# workflow-package-bridge-carrier-move-off-globalthis

## Design

The execution snapshot registry remains owned by core workflow runtime, but the bridge instance exposing that registry must be discoverable from both the main bundle and package `.mjs` modules. The new carrier order is:

1. `runtime.addon?.data.workflowRuntimeBridge`
2. `globalThis.addon?.data.workflowRuntimeBridge`
3. `globalThis.__zsWorkflowRuntimeBridge`

The first available bridge becomes the capability source. Diagnostics expose:

- `bridgeCarrier`
- `bridgeResolved`
- `bridgeToken`
- `hasExecutionToken`

This keeps legacy compatibility while tightening the standard package model to `workflowExecutionToken + addon.data.workflowRuntimeBridge`.

