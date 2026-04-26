# ACP Chat Session Management

## Why

ACP global chat currently stores one replaceable conversation per backend. Now that ACP chat is usable, users need multiple persistent local chat sessions per backend without losing previous transcripts when starting a new conversation.

## What Changes

- Add per-backend chat session management with multiple local conversations and one active conversation.
- Change `New Conversation` from destructive reset to create-and-switch.
- Add session switching, renaming, and deletion for the active ACP backend.
- Store conversations by `backendId + conversationId` and migrate legacy `conversation:<backendId>` records into a default session.
- Preserve the current local-first recovery model: restore local transcript/UI state, but create a new remote ACP session on reconnect/send.

## Capabilities

### New Capabilities

- `acp-chat-session-management`: local multi-session management for ACP global chat.

### Modified Capabilities

- None.

## Impact

- ACP conversation persistence, session manager snapshots, sidebar bridge actions, ACP chat UI, localization, and ACP tests.
- No ACP task engine, workflow provider, remote session resume, or backend manager changes in this change.
