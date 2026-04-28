## Why

ACP chat already exposes connection, plan, and tool states as text, but those states are hard to scan during active sessions. The UI should make important state transitions visible without changing ACP data contracts.

## What Changes

- Add visual status tones for the ACP connection pill based on the existing `snapshot.status`.
- Add plan entry status icons for pending, running, completed, failed, cancelled, and skipped states.
- Add compact LED indicators for tool rows and tool activity drawer rows based on existing tool `state`.
- Add CSS-only spinner and pulse animation with `prefers-reduced-motion` fallback.
- Update ACP UI smoke tests to lock the visual-state helpers and styles.

## Capabilities

### New Capabilities

- `acp-status-visual-feedback`: ACP chat visual feedback for connection, plan, and tool states.

### Modified Capabilities

- None.

## Impact

- Affects ACP chat frontend rendering and CSS only.
- No ACP backend protocol, snapshot schema, session manager state machine, MCP, or permission flow changes.
