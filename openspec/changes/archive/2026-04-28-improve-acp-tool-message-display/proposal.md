## Why

ACP adapters emit tool activity with inconsistent field shapes. The current ACP chat UI falls back to generic values such as `Tool Call`, `[]`, and `Call <toolCallId>`, which makes tool activity hard to scan and caused repeated regressions across Claude Code, OpenCode, Codex, Gemini, and Qwen Code samples.

The saved compatibility samples in `artifact/acp-transcript-samples/2026-04-27/` show that a stable display model must be derived before rendering. `reference/vscode-acp` is useful prior art, but this UI keeps the simpler transcript timeline instead of grouping tools under assistant turns.

## What Changes

- Add an ACP tool display model to snapshots with optional `toolName`, `inputSummary`, and `resultSummary` fields.
- Normalize tool display data in `upsertToolCallItem()` and freeze the first valid input summary.
- Extend ACP protocol typings for common adapter fields such as `rawInput`, `rawOutput`, `name`, `tool`, `functionName`, `function_name`, `output`, `result`, `description`, and `metadata`.
- Render tools as transcript activity items after canonical same-id merge.
- Do not fold plain-mode tool rows into an activity drawer.
- Keep bubble-mode consecutive tool activity drawers for compactness.
- Filter generic display text (`Tool`, `Tool Call`, `other`, `[]`, `{}`, pure `call_*` ids) from the main UI.

## Capabilities

### New Capabilities

- `acp-tool-message-display`: ACP tool call normalization and transcript tool rendering.

### Modified Capabilities

- None.

## Impact

- Affected session model: `src/modules/acpTypes.ts`.
- Affected protocol typings: `src/modules/acpProtocol.ts`.
- Affected session handling: `src/modules/acpSessionManager.ts`.
- Affected UI files: `addon/content/dashboard/acp-chat.js`, `addon/content/dashboard/acp-chat.css`.
- Affected tests: ACP session manager and UI smoke tests.
- No ACP wire protocol, MCP server, permission flow, or agent connection changes.
