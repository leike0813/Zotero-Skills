# acp-chat-layout-tool-rendering Specification

## Purpose
TBD - created by archiving change refine-acp-chat-layout-and-tool-rendering. Update Purpose after archive.
## Requirements
### Requirement: Header Actions Are Compact

The ACP chat page SHALL keep low-frequency controls out of the main conversation space.

#### Scenario: sidebar opens

- **WHEN** the ACP sidebar page renders
- **THEN** the header SHALL expose a `More` menu
- **AND** details, authentication, diagnostics, copy diagnostics, reconnect, new conversation, and close controls SHALL be inside that menu

### Requirement: Composer Remains Visible

The ACP chat page SHALL keep the composer visible when transcript content grows.

#### Scenario: long transcript

- **WHEN** the transcript contains many messages
- **THEN** the transcript SHALL scroll independently
- **AND** the composer SHALL remain visible without page-level scrolling

### Requirement: Overlay Panels Do Not Push Conversation

Details and diagnostics panels SHALL render as overlays with internal scrolling.

#### Scenario: details or diagnostics are opened

- **WHEN** details or diagnostics are visible
- **THEN** they SHALL not change the main shell row sizing
- **AND** they SHALL not push the composer out of view

### Requirement: Tool Calls Are Visually Compact

The ACP chat page SHALL reduce visual space used by tool call items.

#### Scenario: plain mode tool call

- **WHEN** a `tool_call` item is rendered in plain mode
- **THEN** it SHALL render as a one-line compact tool row

#### Scenario: bubble mode consecutive tool calls

- **WHEN** adjacent `tool_call` items are rendered in bubble mode
- **THEN** they SHALL be grouped into one collapsed tool activity bubble
- **AND** clicking the group SHALL expand or collapse the included tool rows
- **AND** the raw ACP snapshot item list SHALL remain unchanged

