# Design

## Reference Inputs

This change is based on the saved transcript samples in `artifact/acp-transcript-samples/2026-04-27/`:

- Claude Code
- OpenCode
- Codex
- Gemini
- Qwen Code

`reference/vscode-acp` was reviewed as prior art for tool presentation. This change does not adopt its turn-based placement because the local ACP chat should preserve the simpler transcript timeline. Its field strategy is also not copied because it primarily trusts `title`, while the local samples show that `title` is often generic.

## Snapshot Display Model

Tool display fields are additive and optional:

- `AcpConversationToolCallItem.toolName?: string`
- `AcpConversationToolCallItem.inputSummary?: string`
- `AcpConversationToolCallItem.resultSummary?: string`

Existing `title`, `toolKind`, and `summary` remain for compatibility. New rendering prioritizes `toolName` and `inputSummary`.

## Backend Normalization

`upsertToolCallItem()` is the single normalization point for `tool_call` and `tool_call_update`.

Tool name extraction order:

1. `name`
2. `tool`
3. `functionName`
4. `function_name`
5. Existing non-generic `toolName`
6. Non-generic `kind`
7. Non-generic `summary` or `title` as last compatibility fallback

Input summary extraction order:

1. `rawInput`
2. `input`
3. `arguments`
4. `args`
5. `parameters`
6. `params`
7. `metadata.description`
8. `metadata.title`
9. top-level `description`
10. non-generic `title`

`inputSummary` is frozen at the first valid value. Pending empty input does not freeze a summary. Later result events must not remove or overwrite the frozen input summary.

Result summary extraction order:

1. `rawOutput`
2. `output`
3. `result`
4. `content`
5. `message`
6. `detail`
7. non-generic `summary`

`resultSummary` may update as the tool progresses.

Generic values are filtered:

- Empty strings
- `Tool`
- `Tool Call`
- `other`
- `[]`
- `{}`
- Pure generated call ids such as `call_...` and `toolu_...`

## Frontend Rendering

Rendering pipeline:

1. Canonicalize duplicate tool calls by `toolCallId || id`.
2. Preserve the selected tool state by priority: `failed`, `completed`, `in_progress`, `pending`.
3. Render canonical tool rows as transcript activity items.
4. In bubble mode only, collapse consecutive different tool rows into a tool activity drawer.

Plain mode:

- No tool activity drawer.
- Consecutive tools render as normal single-line transcript rows in document flow.
- Rows are compact entries: `LED + toolName badge + inputSummary`.

Bubble mode:

- Consecutive different tool rows render as one collapsed activity drawer by default.
- Expanding the drawer shows one row per canonical tool call.

Main UI never displays `completed` or `failed` as text on individual tool rows because state is represented by the LED. The main UI must not show `Call <toolCallId>`, `[]`, or `Tool Call` as the call summary.

## Group Summary

Tool group state uses aggregate priority:

- All completed: green LED.
- All failed: red LED.
- Mixed success/failure or any running tool: yellow LED.
- All pending: grey LED.

Summary text contains counts only, for example `5 tools · 1 failed · 2 running`.
