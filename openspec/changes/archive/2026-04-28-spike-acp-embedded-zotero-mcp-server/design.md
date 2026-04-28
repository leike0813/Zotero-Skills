# Design

## Runtime Shape

The spike adds a singleton embedded MCP server owned by the plugin process. It binds only to `127.0.0.1`, chooses an available port, and exposes a random bearer token. The ACP adapter asks the singleton for a descriptor before each session attachment operation.

If the server cannot start, ACP session creation continues with `mcpServers: []`; the failure is recorded in ACP diagnostics as a non-blocking spike result.

## HTTP/MCP Surface

The server exposes:

- `GET /health`: returns JSON with status and endpoint metadata.
- `POST /mcp`: accepts a single JSON-RPC request/notification. Requests return one JSON-RPC response as `application/json`; notifications return `202 Accepted` with an empty body.
- `GET /mcp`: opens a minimal `text/event-stream` receive stream. When the active ACP descriptor is `type: "sse"`, it advertises the legacy `/mcp/message` endpoint required by `SSEClientTransport`; when the descriptor is `type: "http"`, it behaves as a Streamable HTTP receive stream without legacy endpoint negotiation.

The server is intentionally stateless and does not return `Mcp-Session-Id`. The GET SSE stream is only a compatibility receive stream and does not introduce MCP server-side session state. Supported MCP methods are `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`. The only tool is `zotero.get_current_view`, which has an empty input schema and returns current ACP host context plus a compact text summary.

The diagnostics snapshot keeps a short request ring buffer with HTTP method, path, response status, auth result, content headers, JSON-RPC method/id, and current SSE client count. This is required because OpenCode catches MCP connection failures internally while still allowing ACP session creation to continue.

Compatibility must be verified with the official `@modelcontextprotocol/sdk` `Client` and `StreamableHTTPClientTransport`, not only with handler-level unit tests.

## Security

The HTTP endpoint binds to localhost only and requires `Authorization: Bearer <token>` for `/mcp`. Diagnostics and copied bundles must mask the token. The health endpoint does not expose the token.

## ACP Injection

The ACP session methods receive one OpenCode ACP MCP descriptor when the embedded server is running. The adapter prefers `type: "sse"` when the backend advertises SSE support, and falls back to `type: "http"` only when SSE is unavailable. This is intentionally the ACP runtime `mcpServers` shape, not the OpenCode config-file `mcp` shape.

```json
{
  "name": "zotero",
  "type": "sse",
  "url": "http://127.0.0.1:<port>/mcp",
  "headers": [{ "name": "Authorization", "value": "Bearer <token>" }],
  "enabled": true
}
```

The adapter emits `mcp_server_injected` when the descriptor is added. If OpenCode rejects the descriptor, the existing ACP error path preserves the error and diagnostics.

## Lifecycle

The singleton starts lazily when an ACP session is created, loaded, or resumed. It stops during ACP test reset/runtime cleanup and plugin shutdown hooks where available. This spike does not expose user-facing MCP configuration.
