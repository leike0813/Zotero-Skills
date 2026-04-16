# skillrunner-chat-display-contract Specification

## Purpose
TBD - created by archiving change skillrunner-structured-display-protocol-upgrade. Update Purpose after archive.
## Requirements
### Requirement: SkillRunner frontend MUST prefer backend-projected final display text

Plugin chat rendering MUST treat `assistant.message.final` as already projected
display content.

#### Scenario: final event includes projected display text

- **WHEN** a run-dialog message snapshot includes `displayText`
- **THEN** the browser chat layer MUST render `displayText` as the user-facing
  final text
- **AND** raw `text` MUST remain available only as compatibility metadata

#### Scenario: final event omits projected display text

- **WHEN** a final message snapshot has no `displayText`
- **THEN** the browser chat layer MAY fall back to raw `text`

### Requirement: SkillRunner frontend chat rendering MUST stay free of local structured dispatch

Frontend display MUST not re-interpret structured-output markers to decide chat
rendering.

#### Scenario: structured output reaches the browser chat layer

- **WHEN** browser chat rendering consumes run-dialog snapshot messages
- **THEN** it MUST render backend-projected display text without parsing
  `__SKILL_DONE__`
- **AND** it MUST NOT locally dispatch on structured JSON payload text

#### Scenario: prompt fallback remains non-duplicating

- **WHEN** pending UI hints are absent
- **THEN** the prompt card MAY fall back to compatibility prompt text or a
  default open-text prompt
- **AND** it MUST still avoid repeating the chat-body message

