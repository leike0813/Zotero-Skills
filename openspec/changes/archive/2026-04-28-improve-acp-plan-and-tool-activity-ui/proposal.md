## Why

ACP agents can emit plan and tool activity updates frequently. Rendering every plan and tool event directly in the transcript makes the conversation harder to read and pushes user/assistant messages out of view.

Plans are stateful progress UI, not transcript content. Tool events are operational activity and should be grouped by the underlying tool call.

## What Changes

- Add a dedicated plan panel after `#acp-transcript` and before `.acp-interaction-notices`.
- Hide completed plans and show only the latest active plan.
- Filter `kind === "plan"` items out of transcript rendering.
- Merge `tool_call` items with the same `toolCallId || id` into one non-expandable tool row in both plain and bubble views.
- Collapse consecutive different tool rows into an expandable tool activity drawer.
- Prevent stale tool states from displaying `pending` after the same tool call has already completed.
- Fix plain-mode tool activity drawers so expanded content opens downward in document flow and keeps plain visual density.
- Split streamed assistant/thought chunks into a new region after any intervening transcript or plan/status/tool region.
- Do not change ACP backend protocol, snapshot schema, MCP, session manager, or permission behavior.

## Capabilities

### New Capabilities

- `acp-plan-tool-activity-ui`: ACP chat presentation rules for active plan panels and consolidated tool activity rows.

### Modified Capabilities

- None.

## Impact

- Affected UI files: `addon/content/dashboard/acp-chat.html`, `addon/content/dashboard/acp-chat.css`, `addon/content/dashboard/acp-chat.js`.
- Affected session handling: ACP tool call item upsert and streaming item boundary handling in `src/modules/acpSessionManager.ts`.
- Affected tests: ACP session manager and UI smoke tests.
- No runtime protocol, backend, MCP, or dependency changes.
