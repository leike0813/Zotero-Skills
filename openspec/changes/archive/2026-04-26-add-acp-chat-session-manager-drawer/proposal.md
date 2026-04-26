# Add ACP Chat Session Manager Drawer

## Why

ACP global chat now supports multiple local sessions per backend, but session management is split between a compact selector and destructive actions hidden in `More`. Users need a first-class management surface that can list, switch, rename, and archive sessions without cluttering the chat area.

## What Changes

- Add a `Sessions` button next to `More` in the ACP chat header.
- Open a SkillRunner-like drawer for visible chat sessions across all ACP backends, with the active backend listed first.
- Allow switching, renaming, and archiving sessions from the drawer, including sessions that belong to non-active backends.
- Treat archive as hide-only: archived sessions keep transcript data but disappear from visible lists.
- Remove rename/delete session actions from the `More` menu.
- Keep ACP protocol, remote resume behavior, backend management, and workflow integration unchanged.

## Capabilities

### New Capabilities

- `acp-chat-session-manager-drawer`: ACP sidebar session drawer, visible session indexing, rename, and archive behavior.

### Modified Capabilities

- None.

## Impact

- ACP chat UI HTML/CSS/JS.
- ACP session summary type and local conversation store index metadata.
- ACP session manager actions and sidebar bridge routing.
- ACP UI/core smoke tests.
