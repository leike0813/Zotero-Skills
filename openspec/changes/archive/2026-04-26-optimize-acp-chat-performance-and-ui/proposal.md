# Optimize ACP Chat Performance And UI

## Summary

Improve the ACP OpenCode sidebar so streamed replies stay responsive and the chat layout uses a compact client-style structure. This change does not alter the ACP protocol implementation, backend command resolution, workflow integration boundaries, or provider registry behavior.

## Motivation

The current ACP sidebar becomes sluggish during streamed replies because every `agent_message_chunk` / `agent_thought_chunk` triggers full conversation persistence, full snapshot delivery, and full transcript DOM rebuild. The status and diagnostics areas also consume too much vertical space for a chat-first surface.

## Scope

- Split ACP snapshot notification from persistence flush.
- Throttle streaming UI updates and low-frequency persistence while forcing final prompt persistence.
- Coalesce sidebar snapshot posting to the iframe.
- Render transcript items incrementally by stable item id.
- Keep diagnostics DOM dormant while the diagnostics panel is hidden.
- Replace the large status area with a compact summary plus collapsible details.
- Move mode/model controls into the composer footer next to send/cancel.
- Add `plain` / `bubble` ACP chat display modes, defaulting to `plain`.

## Non-Goals

- No ACP protocol change.
- No OpenCode backend command change.
- No multi-agent support.
- No workflow integration.
- No Backend Manager ACP editor.
- No broader context injection changes.
