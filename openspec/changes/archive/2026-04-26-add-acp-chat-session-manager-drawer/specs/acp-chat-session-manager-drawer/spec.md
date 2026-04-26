# ACP Chat Session Manager Drawer

## ADDED Requirements

### Requirement: Session Management Is A First-Class Header Action

The ACP chat page SHALL expose a dedicated session management button in the header.

#### Scenario: sidebar renders

- **WHEN** the ACP chat page opens
- **THEN** a `Sessions` control SHALL appear next to `More`
- **AND** rename/delete session controls SHALL NOT appear in the `More` menu

### Requirement: Drawer Lists Visible Sessions Across Backends

The ACP chat page SHALL show visible sessions for all ACP backends in a drawer.

#### Scenario: drawer opens

- **WHEN** the user opens the session drawer
- **THEN** the drawer SHALL list unarchived chat sessions grouped by backend
- **AND** the active backend group SHALL appear before other backend groups
- **AND** each row SHALL show title, updated time, message count, status or error summary, and active state

### Requirement: Drawer Manages Sessions

The session drawer SHALL support switching, renaming, and archiving sessions.

#### Scenario: switch session

- **WHEN** the user selects a non-active visible session
- **THEN** the ACP sidebar SHALL switch the active backend and active local conversation to that session

#### Scenario: rename session

- **WHEN** the user renames a session from the drawer
- **THEN** the selected backend's session summary and conversation title SHALL update

#### Scenario: archive session

- **WHEN** the user archives a session
- **THEN** the session SHALL be hidden from its backend selector, drawer group, and frontend snapshot
- **AND** its transcript data SHALL remain stored locally

### Requirement: Active Archive Falls Back Safely

Archiving the active session SHALL activate another visible session or create a new one.

#### Scenario: active session archived with remaining sessions

- **WHEN** the active session is archived
- **THEN** the most recently updated visible session SHALL become active

#### Scenario: active session archived with no remaining sessions

- **WHEN** the active session is archived and no visible sessions remain
- **THEN** a new empty local session SHALL be created and activated

### Requirement: Busy Sessions Are Protected

The ACP chat page SHALL prevent session switching and mutation while the active slot is busy.

#### Scenario: active prompt in progress

- **WHEN** the active ACP session is prompting or waiting for permission
- **THEN** drawer switch, rename, and archive controls SHALL be disabled or rejected
