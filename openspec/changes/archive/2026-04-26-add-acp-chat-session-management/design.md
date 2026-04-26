# Design

## Storage Model

ACP chat storage becomes per backend and per conversation. A backend has a small session index with `activeConversationId` and session summaries. Each conversation snapshot and transcript is stored under a stable `conversation:<backendId>:<conversationId>` request id.

Legacy `conversation:<backendId>` storage is migrated on first read into one default session. The migrated session keeps the existing transcript and local UI state, then the legacy request/rows are removed to avoid double reads.

## Runtime Model

The current backend slot continues to hold one active snapshot and one remote ACP attachment. Switching local conversations persists the current snapshot, disconnects the current adapter, loads the target local snapshot, clears remote `sessionId`, and emits the target snapshot. The target creates a fresh remote ACP session when the user reconnects or sends.

Actions such as send, cancel, reconnect, auth, permission, mode/model, diagnostics, and display mode apply only to the active conversation for the active backend.

## UI Model

The ACP header shows a session selector next to the backend selector. `New Conversation` creates an empty local session and switches to it. Rename and delete are available from the existing More menu. Busy or permission-blocked conversations cannot be switched or deleted.

The sidebar receives `chatSessions` and `activeConversationId` through `AcpFrontendSnapshot`. The transcript area continues to render the active snapshot only.

## Deletion and Fallback

Deleting the active conversation selects the most recently updated remaining conversation for the same backend. If no session remains, a new empty session is created. Deleting a backend clears only that backend's session index and conversation rows.

## Recovery

On plugin restart, the active backend, active conversation id, session list, transcript, UI state, and workspace metadata are restored locally. Remote ACP `sessionId` is not trusted and is cleared before any new connection.
