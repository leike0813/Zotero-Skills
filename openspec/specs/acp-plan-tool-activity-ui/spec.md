# acp-plan-tool-activity-ui Specification

## Purpose
TBD - created by archiving change improve-acp-plan-and-tool-activity-ui. Update Purpose after archive.
## Requirements
### Requirement: Plan Panel

ACP chat UI SHALL render active agent plans in a dedicated plan panel positioned after the transcript and before interaction notices.

#### Scenario: Active plan is shown outside transcript

- Given a snapshot contains a `plan` item with at least one non-terminal entry
- When the chat UI renders the snapshot
- Then `#acp-plan-panel` is visible
- And the transcript does not contain the plan item

#### Scenario: Completed plan is hidden

- Given a snapshot contains only plans whose entries are terminal
- When the chat UI renders the snapshot
- Then `#acp-plan-panel` is hidden
- And the completed plan is not rendered in the transcript

### Requirement: Tool Call Consolidation

ACP chat UI SHALL consolidate tool activity by `toolCallId`, falling back to item `id` when `toolCallId` is unavailable.

#### Scenario: Same tool call renders as one non-expandable row

- Given a snapshot contains multiple `tool_call` items with the same `toolCallId`
- When the chat UI renders the transcript in plain or bubble mode
- Then the transcript contains one normal tool row for that tool call
- And the row uses the latest state and summary
- And the original same-key tool events are not exposed as expandable transcript details

#### Scenario: Consecutive different tools render as an activity drawer

- Given a snapshot contains consecutive `tool_call` items with different `toolCallId` values
- When the chat UI renders the transcript in plain or bubble mode
- Then those tool rows are wrapped in one collapsed tool activity drawer
- And expanding the drawer shows one summary row per different tool

#### Scenario: Plain tool drawer expands downward

- Given the transcript is in plain mode
- And a tool activity drawer is expanded
- When the chat UI renders the drawer
- Then the drawer uses a vertical layout in normal document flow
- And the expanded list does not overlap previous messages
- And the expanded rows keep compact plain-mode styling

#### Scenario: Tool grouping preserves timeline

- Given a snapshot contains messages and tool calls
- When tool groups are derived
- Then each tool group is ordered by the earliest item in that group
- And non-tool items keep their original relative order

### Requirement: Frontend-Only Change

This change SHALL NOT modify ACP backend protocol, snapshot schema, or MCP behavior.

#### Scenario: UI rendering changes preserve backend contracts

- Given ACP chat receives the existing conversation snapshot schema
- When plan and tool activity UI rendering changes are applied
- Then no new ACP backend request or response fields are required
- And MCP server behavior is unchanged

### Requirement: Tool Snapshot Upsert

ACP session snapshots SHALL NOT accumulate duplicate `tool_call` items for the same non-empty `toolCallId`.

#### Scenario: Stale pending does not override completed

- Given a `tool_call_update` marks `tool-1` completed
- When a later `tool_call` notification for `tool-1` reports pending
- Then the snapshot contains one `tool_call` item for `tool-1`
- And its state remains `completed`

#### Scenario: Different tool ids remain distinct

- Given notifications for `tool-1` and `tool-2`
- When the snapshot is built
- Then the snapshot contains separate tool rows for each id

### Requirement: Streaming Region Boundaries

ACP session snapshots SHALL append streamed assistant message and thought chunks only to the latest compatible region.

#### Scenario: Assistant chunk after a tool creates a new message

- Given an assistant message chunk creates a streaming assistant message
- And a tool call is added after that message
- When another assistant message chunk arrives
- Then the snapshot contains a second assistant message
- And the first assistant message is not modified by the later chunk

#### Scenario: Thought chunk after assistant output creates a new thought

- Given a thought chunk creates a streaming thought item
- And an assistant message is added after that thought
- When another thought chunk arrives
- Then the snapshot contains a second thought item
- And the first thought item is not modified by the later chunk

#### Scenario: Same-id tool update does not add a boundary

- Given a tool row already exists for a `toolCallId`
- When a `tool_call_update` updates that same row
- Then the snapshot does not append a duplicate tool row
- And the update does not create an additional transcript region

