# acp-tool-message-display Specification

## Purpose
TBD - created by archiving change improve-acp-tool-message-display. Update Purpose after archive.
## Requirements
### Requirement: Tool Display Fields

ACP conversation snapshots SHALL support optional tool display fields without breaking older snapshots.

#### Scenario: Tool item carries normalized display data

- Given a tool call update contains a tool name and input arguments
- When the ACP session manager records the update
- Then the resulting `tool_call` item may include `toolName`
- And it may include `inputSummary`
- And it may include `resultSummary`
- And existing `title`, `toolKind`, and `summary` fields remain available

### Requirement: Tool Input Summary Freezing

ACP session manager SHALL freeze the first valid input summary for a tool call.

#### Scenario: Pending empty input does not freeze

- Given a pending tool call update contains no valid input summary
- When a later update for the same `toolCallId` contains input arguments
- Then the later input arguments become `inputSummary`

#### Scenario: Result does not overwrite input summary

- Given a tool call has a valid `inputSummary`
- When a completed result update arrives
- Then the `inputSummary` remains unchanged
- And result content may update `resultSummary`

### Requirement: Generic Tool Text Filtering

ACP tool display normalization SHALL filter generic display text from main UI fields.

#### Scenario: Generic summary is ignored

- Given a tool update has `summary` equal to `[]`
- When the tool item is normalized
- Then `[]` is not used as `inputSummary`
- And the main UI does not show `[]` as a tool summary

#### Scenario: Generated call id is ignored

- Given a tool update only exposes a generated id such as `call_abc123`
- When the tool row renders
- Then the main UI does not display `Call call_abc123`

### Requirement: Transcript Tool Rendering

ACP chat UI SHALL render tool calls as transcript activity while preserving message timeline boundaries.

#### Scenario: Tool call remains transcript activity

- Given a snapshot contains assistant output and tool calls
- When the chat UI renders the transcript
- Then canonical tool rows are rendered as tool transcript activity items
- And assistant messages and thoughts remain normal transcript items

#### Scenario: Plain mode does not fold tools

- Given the transcript is in plain mode
- When consecutive tool rows are present
- Then each canonical tool row renders separately in normal document flow
- And no plain-mode tool activity drawer is used

#### Scenario: Bubble mode folds consecutive tool batches

- Given the transcript is in bubble mode
- And consecutive canonical tool rows are present
- When the chat UI renders the transcript
- Then the consecutive tool rows may render as a collapsed activity drawer
- And expanding the group shows one row per canonical tool call

### Requirement: Tool Row Display

ACP chat UI SHALL render compact, informative tool rows.

#### Scenario: Tool row uses name and input summary

- Given a normalized tool item has `toolName` and `inputSummary`
- When the row renders
- Then it displays a state LED
- And it displays the tool name as a badge
- And it displays the input summary as the single-line call summary

#### Scenario: Tool row omits state text

- Given a normalized tool item is completed
- When the row renders
- Then the row state is represented by LED styling
- And the row does not display `completed` as user-facing text

### Requirement: Compatibility Samples

ACP tool display normalization SHALL remain compatible with the saved Claude Code, OpenCode, Codex, Gemini, and Qwen Code samples in `artifact/acp-transcript-samples/2026-04-27/`.

#### Scenario: Common adapter field variants are supported

- Given tool updates use fields such as `name`, `tool`, `functionName`, `function_name`, `input`, `args`, `arguments`, `parameters`, `rawInput`, `output`, or `rawOutput`
- When the session manager normalizes the updates
- Then tool name, input summary, and result summary are extracted from the strongest available fields

