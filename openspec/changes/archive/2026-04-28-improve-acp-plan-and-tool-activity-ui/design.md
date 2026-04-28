# Design

## Plan Panel

The ACP chat shell gains `#acp-plan-panel` after `#acp-transcript` and before `.acp-interaction-notices`. The panel renders derived state from existing `AcpConversationPlanItem.entries`; it does not introduce new model fields.

Rendering rules:

- Use the latest `kind === "plan"` item that contains at least one non-terminal entry.
- Terminal states are matched loosely: `complete`, `completed`, `done`, `succeeded`, `success`, `skipped`, `cancelled`, `canceled`, `failed`, `error`.
- If no active plan exists, add `hidden` and clear panel content.
- Transcript rendering filters out all `plan` items.

## Tool Consolidation

Tool activity is converted in two stages.

Same tool call merge rules:

- Key is `toolCallId`; if missing, fallback to `id`.
- Same-key events render as one normal, non-expandable tool row.
- The displayed state is chosen by priority: `failed`, `completed`, `in_progress`, `pending`.
- Same-priority events use latest `updatedAt || createdAt`.
- Original same-key event details are not shown in the transcript; diagnostics remain the debugging surface.

Adjacent activity rules:

- After same-key merge, consecutive different tool rows are wrapped in a derived `tool_activity_group`.
- Activity groups are ordered by the first tool row in the run.
- Activity groups are collapsed by default and can be toggled with `toolActivityExpandedIds`.
- Expanded groups show one summary row per different tool, not raw same-key event history.
- In plain mode, activity groups use a vertical layout when expanded so the drawer opens downward in normal document flow instead of keeping the single-line tool row centering behavior.
- Plain activity drawer entries remain compact line rows; bubble mode keeps the existing card-like transcript styling.

## Session Snapshot Tool Upsert

ACP `tool_call` and `tool_call_update` notifications are normalized through one upsert helper:

- If `toolCallId` is present and an item already exists, update that item instead of appending a duplicate.
- If a completed/failed item later receives a stale pending/in-progress update for the same `toolCallId`, keep the higher-priority state.
- If no `toolCallId` is present, append a new item because safe correlation is impossible.

## Streaming Region Boundaries

Assistant message and thought chunks are only appended to an active item when that item is still the latest region in the snapshot item order:

- `agent_message_chunk` may append only to the active assistant message item when that item is the latest snapshot item.
- `agent_thought_chunk` may append only to the active thought item when that item is the latest snapshot item.
- If a different region has appeared after the active item, the next chunk creates a new item.
- Tool updates that only update an existing tool item do not create a new snapshot region by themselves; first-time tool calls, plans, and status items do.

## Layout

The chat shell grid becomes:

1. Header
2. Controls
3. Transcript
4. Plan panel
5. Interaction notices
6. Composer

When `#acp-plan-panel.hidden` is applied, it does not occupy layout height.
