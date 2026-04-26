# Design

## Restore Model

The plugin keeps two ids:

- `conversationId`: stable local chat session id and workspace owner.
- `remoteSessionId`: last known agent-side ACP session id that may be recoverable.

`sessionId` remains the currently attached runtime id. On plugin restart or local conversation switch, `sessionId` starts empty while `remoteSessionId` may be present. The next reconnect/send attempts to attach the remote session before creating a new one.

## Capability Handling

The local ACP protocol layer parses `initialize.result.agentCapabilities`:

- `agentCapabilities.loadSession === true` enables `session/load`.
- `agentCapabilities.sessionCapabilities.resume` enables `session/resume`.

The client MUST NOT call these methods unless the capability is present. If neither capability is declared, restore status becomes `unsupported` and the flow uses `session/new`.

## Restore Flow

When `ensureSession()` needs a session:

1. If runtime `sessionId` exists, reuse it.
2. If `remoteSessionId` exists and resume is supported, call `session/resume`.
3. Else if `remoteSessionId` exists and load is supported, call `session/load`.
4. If restore succeeds, set runtime `sessionId = remoteSessionId`.
5. If restore fails or is unsupported, call `session/new`, store the returned id as both `sessionId` and `remoteSessionId`, and mark restore status as fallback or unsupported.

`session/load` can replay historical `session/update` events. During load restore, local transcript remains authoritative, so text/tool/plan update events are allowed to update state metadata but MUST NOT duplicate existing transcript items.

## Diagnostics and UI

Diagnostics record restore lifecycle events: attempted, succeeded, failed, and fallback. The sidebar shows remote restore status and both local conversation id and remote session id in details/diagnostics. A fallback warning is shown as a status item so users know agent context may have changed.

## Compatibility

Existing snapshots that only have `sessionId` are migrated by treating that value as `remoteSessionId` and clearing runtime `sessionId` on load. Backends without restore capability keep current behavior with explicit `unsupported` state.
