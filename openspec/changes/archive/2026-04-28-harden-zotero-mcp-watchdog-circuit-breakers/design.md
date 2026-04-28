# Design

## Guard Model

The MCP server keeps a guard snapshot beside the existing queue snapshot:

- `restartCount`, `lastRestartAt`, `lastFatalError`, `descriptorStale`
- `activeTool`, `runningStartedAt`, `runningTimeoutMs`
- `circuitBreakers`: per-tool failure count, open-until timestamp, last error, and state

The guard snapshot is diagnostic-only and must not expose tokens. It is included in MCP status diagnostics and the new `zotero.get_mcp_status` tool.

## Timeout And Circuit Breaker

Pending timeout remains the existing queue wait timeout. Running timeout is separate and defaults to 45 seconds. A running timeout returns JSON-RPC error `-32003` with `data.code = "zotero_mcp_tool_timeout"`.

Circuit breaker counting applies only to tool execution failures that look like native/runtime/timeout/transport failures. Parameter errors, not-found errors, permission denials, queue full, and queue timeout do not count. The v1 breaker opens after three qualifying failures within five minutes and stays open for sixty seconds.

## Watchdog

Request listener catch blocks should try to write a fallback HTTP response before closing the transport. Fatal request failures update guard state and schedule a best-effort restart. If the restart uses a different endpoint, `descriptorStale` becomes true so ACP diagnostics can tell the user to reconnect the session.

## Status Tool

`zotero.get_mcp_status` returns a JSON-safe server/queue/guard/recent-request summary. It does not enter the tool-call queue and should be safe to call while another tool is running.
