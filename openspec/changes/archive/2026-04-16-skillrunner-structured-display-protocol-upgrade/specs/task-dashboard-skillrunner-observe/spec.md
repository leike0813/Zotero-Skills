## ADDED Requirements

### Requirement: SkillRunner run dialog prompt card MUST consume pending UI hints only

The plugin run dialog MUST keep pending chat text and prompt-card hints
separate.

#### Scenario: pending branch reaches the run dialog

- **WHEN** the backend exposes a pending interaction
- **THEN** the chat panel MUST render the pending message from `/chat`
- **AND** the prompt card MUST use `ui_hints.prompt`, `ui_hints.hint`,
  `ui_hints.options`, and `ui_hints.files`
- **AND** the prompt card MUST NOT duplicate the pending chat message

### Requirement: SkillRunner run dialog final summary MUST remain status-only

The plugin run dialog MAY keep a final summary card, but it MUST stay status
only.

#### Scenario: terminal run reaches final chat projection

- **WHEN** the backend exposes final assistant text through `/chat`
- **THEN** the chat panel MUST render that final text in chat
- **AND** the final summary card MUST only expose terminal status
- **AND** the final summary card MUST NOT repeat the same final chat text or
  structured payload
