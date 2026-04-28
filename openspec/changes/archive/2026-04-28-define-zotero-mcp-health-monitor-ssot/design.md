# Design: Zotero MCP Health Monitor SSOT

## Current Problem

The ACP UI has enough raw fields to display detailed diagnostics, but it is the wrong layer to infer MCP service health. The UI cannot reliably know whether missing `mcpServer` means "not started", "snapshot stale", "descriptor injected but no request yet", or "server restarted and descriptor is stale".

## Health Snapshot Contract

The host computes a JSON-safe snapshot:

```ts
type ZoteroMcpHealthSnapshot = {
  state:
    | "unavailable"
    | "starting"
    | "listening"
    | "injected"
    | "handshake_seen"
    | "tools_seen"
    | "active"
    | "degraded"
    | "circuit_open"
    | "descriptor_stale"
    | "error";
  severity: "neutral" | "ok" | "active" | "warning" | "error";
  summary: string;
  tooltip: string[];
  endpoint: string;
  descriptorInjected: boolean;
  descriptorStale: boolean;
  clientHandshakeSeen: boolean;
  toolsListSeen: boolean;
  toolCallSeen: boolean;
  queueDepth: number;
  activeTool: string;
  openCircuitCount: number;
  lastError: string;
  recommendedAction: string;
  updatedAt: string;
};
```

## Derivation Rules

Priority order:

1. `error`: server status is `error` or a fatal error is recorded.
2. `descriptor_stale`: guard says the server restarted on a different endpoint after descriptor injection.
3. `circuit_open`: one or more tool circuit breakers are open.
4. `degraded`: server is running but latest request/tool call has a safe error, queue timeout, tool timeout, or lastError.
5. `active`: running queue depth > 0 or guard active tool is set.
6. `tools_seen`: latest requests include `tools/list`.
7. `handshake_seen`: latest requests include `initialize`.
8. `injected`: host recorded `mcp_server_injected` or descriptor injection flag.
9. `listening`: server status is `running` but no client handshake is seen.
10. `starting`: server status is `starting`.
11. `unavailable`: no server and no recent injected descriptor.

Severity mapping:

- `ok`: injected/listening/handshake/tools seen.
- `active`: active tool/queue.
- `warning`: degraded/circuit/descriptor stale.
- `error`: error/unavailable caused by unavailable diagnostic.
- `neutral`: starting or absent but no error evidence.

## UI Boundary

The ACP chat UI receives `snapshot.mcpHealth` and renders:

- LED color from `severity`.
- Short label `MCP`.
- Tooltip from host-provided `tooltip`.

The UI may provide a defensive fallback only when older snapshots do not include `mcpHealth`, but that fallback must not become the primary health state machine.

## Diagnostics Boundary

`mcpServer` remains in diagnostics for raw details. `zotero.get_mcp_status` remains available to connected agents. `/health` can continue returning server-level state, but the dashboard should consume the snapshot rather than probe HTTP from the browser.

## Non-Goals

- No new MCP tools.
- No endpoint restart or descriptor hot-swap behavior changes.
- No changes to queue, guard, permission, or Streamable HTTP transport behavior.
