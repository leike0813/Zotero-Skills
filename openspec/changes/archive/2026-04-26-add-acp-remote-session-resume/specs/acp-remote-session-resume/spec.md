# acp-remote-session-resume Specification

## ADDED Requirements

### Requirement: Capability-Gated Remote Restore

The system SHALL attempt remote ACP chat session restoration only when the backend declares support during initialize.

#### Scenario: Backend supports resume

- **GIVEN** a local ACP conversation has a persisted `remoteSessionId`
- **AND** initialize returns `agentCapabilities.sessionCapabilities.resume`
- **WHEN** the user reconnects or sends a prompt
- **THEN** the system MUST call `session/resume` before `session/new`
- **AND** the restored runtime `sessionId` MUST equal the persisted `remoteSessionId`.

#### Scenario: Backend supports load but not resume

- **GIVEN** a local ACP conversation has a persisted `remoteSessionId`
- **AND** initialize returns `agentCapabilities.loadSession: true`
- **AND** resume capability is absent
- **WHEN** the user reconnects or sends a prompt
- **THEN** the system MUST call `session/load` before `session/new`.

#### Scenario: Backend does not support restore

- **GIVEN** a local ACP conversation has a persisted `remoteSessionId`
- **AND** initialize does not declare resume or load support
- **WHEN** the user reconnects or sends a prompt
- **THEN** the system MUST NOT call `session/resume` or `session/load`
- **AND** the system MUST create a new session with `session/new`
- **AND** the snapshot MUST expose restore status `unsupported`.

### Requirement: Safe Fallback

The system SHALL fall back to a new ACP session when remote restore fails.

#### Scenario: Restore fails

- **GIVEN** a backend declares restore support
- **AND** `session/resume` or `session/load` returns an error
- **WHEN** the system handles the reconnect or prompt
- **THEN** it MUST call `session/new`
- **AND** it MUST update the persisted `remoteSessionId` to the new session id
- **AND** diagnostics MUST include restore failure and fallback events.

### Requirement: Local Transcript Remains SSOT

The system SHALL keep local transcript as the visible chat source of truth.

#### Scenario: Load replays history

- **GIVEN** `session/load` emits historical `session/update` notifications
- **WHEN** the local conversation already has transcript items
- **THEN** the system MUST NOT duplicate those transcript items
- **AND** the system MAY use replayed state updates for metadata such as mode, model, usage, and session info.

### Requirement: Migration

The system SHALL migrate legacy persisted remote ids without treating them as already attached runtime sessions.

#### Scenario: Old snapshot has sessionId

- **GIVEN** persisted snapshot payload contains `sessionId` but no `remoteSessionId`
- **WHEN** the conversation is loaded
- **THEN** the system MUST set `remoteSessionId` from the persisted `sessionId`
- **AND** runtime `sessionId` MUST be empty until restore or new-session attach succeeds.

### Requirement: Visibility

The system SHALL make remote restore behavior observable.

#### Scenario: Restore fallback occurs

- **WHEN** a restore attempt fails and the system creates a new session
- **THEN** the sidebar snapshot MUST expose restore status `fallback-new`
- **AND** the transcript MUST include a compact warning status item
- **AND** diagnostics MUST include the restore attempt, failure, and fallback.
