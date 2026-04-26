# Tasks

## OpenSpec

- [x] Create proposal/design/tasks/spec artifacts for `add-acp-chat-session-management`.

## Persistence

- [x] Add per-backend session index storage.
- [x] Add per-conversation load/save/delete APIs keyed by `backendId + conversationId`.
- [x] Migrate legacy `conversation:<backendId>` storage into a default session.

## Runtime

- [x] Update ACP session manager to load and persist active conversations.
- [x] Implement create/switch/rename/delete chat session actions.
- [x] Ensure switching/deleting is blocked while prompting or permission-required.
- [x] Clear remote `sessionId` on restored/switched conversations.

## UI

- [x] Add session selector next to backend selector.
- [x] Add rename/delete controls to the More menu.
- [x] Route session actions through the ACP sidebar bridge.
- [x] Update labels/locales and diagnostics/session metadata display.

## Tests

- [x] Add core tests for legacy migration, multi-session persistence, switching, deletion fallback, and remote session reset.
- [x] Add UI smoke tests for session selector and session actions.
- [x] Run `npm run test:node:raw:core`.
- [x] Run `npm run test:node:raw:ui`.
- [x] Run `npx tsc --noEmit`.
