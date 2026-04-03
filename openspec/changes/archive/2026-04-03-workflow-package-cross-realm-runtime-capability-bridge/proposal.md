# workflow-package-cross-realm-runtime-capability-bridge

## Why

`workflow-package` uses `resource://...` loaded `.mjs` modules in Zotero runtime. Those modules do not reliably share the same realm-local globals as the main bundle or legacy temp-hook scripts. Passing the full `runtime` object directly, or relying on `globalThis.__zsCurrentWorkflowExecutionRuntime`, is therefore not a stable capability transport.

The current failure mode is concrete:

- `tag-regulator` is disabled with `prefs API is unavailable in current runtime`
- `reference-matching` and `reference-note-editor` are disabled with `items API is unavailable in current runtime`

These are not product-level input problems. They are runtime capability transport failures across realms.

## What Changes

- Add a token-based workflow execution capability bridge to core runtime infrastructure.
- Register a capability snapshot for each hook execution and pass only the execution token as the stable cross-realm handle.
- Update workflow-package runtime accessors to resolve capabilities from the bridge first.
- Preserve legacy `.js` workflow compatibility.
- Extend diagnostics and debug probe output with bridge-state information.

## Impact

- `workflow-package` becomes stable in real Zotero runtime without changing workflow manifests or product behavior.
- Builtin and user workflow-packages share the same capability model.
- Legacy single-file workflows remain compatible.
