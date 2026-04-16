## Why

`artifact/frontend_upgrade_guide_2026-04-15.md` and the updated
`reference/Skill-Runner` E2E frontend define a stricter chat display contract:

- `/chat` and `/chat/history` are the only chat-body source
- `assistant.message.final.data.display_text` is the frontend-primary final text
- `/interaction/pending` only feeds prompt-card UI hints
- final summary may remain visible, but it must stay status-only

The current plugin frontend still drifts from that contract:

- run-dialog snapshot messages do not expose `displayText` / `displayFormat`
- browser chat rendering still only consumes `text`
- pending prompt card still treats `pendingPrompt/askUser.prompt` as the primary
  prompt source
- prompt card has no dedicated `ui_hints.files` surface

That drift keeps the plugin frontend behind the latest backend protocol and
risks local structured-output display behavior creeping back into the UI layer.

## What Changes

- Create change `skillrunner-structured-display-protocol-upgrade`
- Upgrade SkillRunner run-dialog snapshot messages to carry backend-projected
  display metadata
- Make browser chat rendering prefer projected `displayText`
- Tighten prompt-card/final-summary responsibility split
- Add specs and regressions for backend-driven display alignment

## Capabilities

### Modified Capabilities

- `task-dashboard-skillrunner-observe`
  - Tightens prompt-card vs chat vs final-summary responsibilities for the run
    dialog

### New Capabilities

- `skillrunner-chat-display-contract`
  - Defines backend-driven `display_text/display_format` handling and prompt
    card display rules

## Impact

- Updates `skillRunnerRunDialog` snapshot/message normalization
- Updates `run-dialog.html` / `run-dialog.js` chat and prompt-card rendering
- Updates run dialog alignment and message-model regression tests
