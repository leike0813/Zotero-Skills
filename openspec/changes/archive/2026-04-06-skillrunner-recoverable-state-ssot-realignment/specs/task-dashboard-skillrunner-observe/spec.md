## ADDED Requirements

### Requirement: request-created local failure MUST remain recoverable non-terminal state

Plugin MUST distinguish backend terminal failure from plugin-side communication
failure after `requestId` creation.

#### Scenario: local failure after request-created does not become terminal failed

- **WHEN** a SkillRunner request has already emitted `request-created`
- **AND** plugin-side dispatch/poll/fetch later fails locally
- **THEN** plugin MUST keep the task in a recoverable non-terminal state
- **AND** plugin MUST preserve request context and request ledger ownership
- **AND** plugin MUST NOT speculate terminal `failed`

#### Scenario: restart preserves recoverable running request

- **WHEN** plugin restarts with a recoverable SkillRunner request that is still
  backend non-terminal
- **THEN** plugin MUST restore it as recoverable non-terminal state
- **AND** plugin MUST continue reconcile/sync against backend truth
- **AND** plugin MUST NOT downgrade it to `failed` before backend terminal
  double-confirm
