# Design

## Session Drawer

The ACP chat header adds a compact `Sessions` button immediately before `More`. The button opens an overlay drawer that does not participate in the main shell grid height. The drawer groups visible sessions across all ACP backends, ordering the active backend first. The compact selector remains scoped to the active backend for quick switching.

Each row shows backend group, title, updated time, message count, status/error summary, and active state. Clicking a row switches to that backend and session. Rename and archive are row-level actions.

## Archive Semantics

Archive is hide-only. `AcpChatSessionSummary` gains `archivedAt?: string`; archived summaries remain in the session index, and their conversation request/rows are not deleted. Visible session APIs filter archived summaries by default, so the selector, drawer, and frontend snapshot exclude archived sessions.

If the active session is archived, the manager disconnects the current remote attachment and activates the most recently updated unarchived session. If none remain, it creates a new empty local session.

## Action Routing

The iframe sends `archive-conversation` with a `backendId` and `conversationId`. Existing `rename-conversation` is extended to accept optional `backendId` and `conversationId`; omitting them keeps the current active-session behavior.

Session switch, rename, and archive are blocked while the active slot is prompting or waiting for permission to avoid mismatched permission resolvers and stream state. Switching to a non-active backend session first activates that backend, then activates the selected local conversation.

## Compatibility

The ACP wire protocol, remote session resume behavior, backend registry, and workflow boundaries are unchanged. `deleteActiveAcpConversation()` can remain for internal compatibility, but the ACP sidebar no longer exposes delete in the `More` menu.
