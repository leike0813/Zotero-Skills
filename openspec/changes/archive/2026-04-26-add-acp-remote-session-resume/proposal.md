## Why

ACP chat sessions currently restore only local transcript and UI state after plugin restart. This makes the UI look persistent while the agent-side conversation context is lost, which breaks the expectation created by showing a remote `sessionId`.

## What Changes

- Add capability-gated remote ACP session restoration for global chat.
- Persist the latest remote session id as a recoverable attachment candidate, separate from the currently attached runtime `sessionId`.
- Try `session/resume` first, then `session/load`, and fall back to `session/new` when unsupported or failed.
- Surface restore capability, attempts, success, and fallback in diagnostics and sidebar state.
- Keep local transcript as the plugin-side SSOT; do not replay local transcript into the agent as a fake restore path.

## Capabilities

### New Capabilities

- `acp-remote-session-resume`: Capability-gated restoration of agent-side ACP chat sessions from persisted remote session ids.

### Modified Capabilities

- `acp-engine-session-workspace-governance`: Clarify that remote `sessionId` is not SSOT but may be persisted and attempted as a recoverable runtime attachment when the backend declares support.
- `acp-chat-session-management`: Upgrade restart semantics from local-only recovery to best-effort remote restore for each active local chat session.

## Impact

- ACP protocol/client subset gains `session/load`, `session/resume`, and initialize capability parsing.
- ACP adapter and session manager gain restore attempts before `session/new`.
- ACP conversation persistence migrates old stored `sessionId` into `remoteSessionId`.
- ACP sidebar snapshot and diagnostics expose restore status and fallback.
- Tests cover capability parsing, restore order, fallback, migration, and UI visibility.
