# ACP Multi-Backend Sessions

## ADDED Requirements

### Requirement: ACP backend profiles are configurable

The system SHALL allow users to manage multiple ACP backend profiles with `displayName`, `command`, `args`, and `env`.

#### Scenario: User creates an ACP backend profile

- **WHEN** the user adds an ACP backend in Backend Manager
- **THEN** the backend is persisted as `type: "acp"`
- **AND** its `command`, `args`, and `env` are preserved.

### Requirement: ACP sessions are isolated by backend

The system SHALL maintain independent ACP session state per backend id.

#### Scenario: User connects two ACP backends

- **WHEN** two ACP backends are connected
- **THEN** each backend has an independent adapter, snapshot, diagnostics, transcript, and permission state.

### Requirement: ACP sidebar can switch active backend

The ACP sidebar SHALL expose an active backend selector.

#### Scenario: User switches backend

- **WHEN** the user selects a different ACP backend
- **THEN** the visible transcript and controls reflect that backend
- **AND** existing sessions for other backends remain connected.

### Requirement: ACP frontend state persists active backend

The system SHALL persist the active ACP backend id locally.

#### Scenario: Zotero restarts

- **WHEN** the ACP sidebar opens after restart
- **THEN** the last active backend is selected when it still exists
- **AND** the selected backend transcript is restored locally.
