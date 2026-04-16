# Design: skillrunner-structured-display-protocol-upgrade

## 1. Core Decision

This change aligns the plugin frontend with the current backend-driven display
contract. It does not introduce a new protocol shape on the plugin side.

The core rules are:

1. chat body stays on `/chat` and `/chat/history`
2. final assistant display prefers `display_text`
3. prompt card only consumes `ui_hints.*`
4. final summary card remains status-only
5. no frontend display branch may depend on `__SKILL_DONE__`

## 2. Host Snapshot Changes

`skillRunnerRunDialog.ts` extends browser-facing message snapshots with:

- `displayText?: string`
- `displayFormat?: string | null`

The host keeps `text` as the raw/compat field, but derives user-facing display
from `displayText` when present.

## 3. Browser Rendering Contract

`run-dialog.js` keeps the existing plain/bubble chat core, but changes content
ownership:

- `toChatEvent()` projects `displayText || text` into chat
- prompt-card text comes from `pendingUiHints.prompt`
- prompt-card files come from `pendingUiHints.files`
- `pendingPrompt/askUser.prompt` become compatibility fallback only
- final summary card renders terminal status only

No new structured-output parsing is added to the browser layer.

## 4. Compatibility

- If `displayText` is absent, chat falls back to `text`
- If `pendingUiHints.prompt` is absent, prompt card falls back to
  `askUser.prompt/pendingPrompt`, then `DEFAULT_INTERACTION_PROMPT`
- waiting-auth specific auth card behavior remains intact

## 5. Non-goals

- no backend API changes
- no provider/model/effort changes
- no SSOT state-machine changes
- no new frontend render-dispatch keyed on `display_format`
