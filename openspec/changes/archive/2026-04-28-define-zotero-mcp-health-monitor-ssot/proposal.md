## Why

The ACP chat MCP LED currently infers service health in the browser from raw `mcpServer` and diagnostic fragments. That makes the UI fragile: if `mcpServer` is temporarily absent from the sidebar snapshot, the indicator can report "unavailable" even when the backend already injected the Zotero MCP descriptor.

Zotero MCP health should be a host-side single source of truth. The host owns the server socket, descriptor injection, queue, guard state, recent requests, and restart status, so it should derive the semantic health state and let the ACP UI render it without guessing.

## What Changes

- Add a host-side `ZoteroMcpHealthSnapshot` derived from MCP server state, descriptor injection diagnostics, request history, queue state, and guard/circuit breaker state.
- Include `mcpHealth` in ACP session/sidebar snapshots while retaining `mcpServer` as detailed diagnostics.
- Change the ACP MCP LED to render only `snapshot.mcpHealth` tone/summary/tooltip instead of rebuilding a health state machine in `acp-chat.js`.
- Keep `zotero.get_mcp_status` as the agent-facing diagnostic tool for clients that can already reach MCP.
- Keep `/health` and `mcpServer` diagnostics for low-level debugging, but do not make the UI derive readiness directly from them.
- No wire protocol, MCP tool, permission, queue, or watchdog behavior changes.

## Capabilities

### New Capabilities

- `zotero-mcp-health-monitor`: Defines the host-side MCP health snapshot contract and ACP UI consumption rule.

### Modified Capabilities

- None.

## Impact

- `src/modules/zoteroMcpServer.ts`: derives and exposes semantic health.
- `src/modules/acpTypes.ts`: adds health snapshot types and snapshot fields.
- `src/modules/acpSessionManager.ts`: includes `mcpHealth` in active and diagnostics snapshots.
- `src/modules/acpSidebarModel.ts`: forwards `mcpHealth` to the dashboard sidebar.
- `addon/content/dashboard/acp-chat.js`: removes raw MCP health inference and renders `mcpHealth`.
- `addon/content/dashboard/acp-chat.css`: keeps compact LED styling mapped to health severity.
- `test/core/101-zotero-mcp-server.test.ts` and `test/core/97-acp-ui-smoke.test.ts`: cover host-side health derivation and UI consumption.
