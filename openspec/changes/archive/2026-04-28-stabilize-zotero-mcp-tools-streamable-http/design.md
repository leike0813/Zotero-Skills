# Design

## Transport

The embedded server is a minimal stateless Streamable HTTP MCP endpoint. It does not return `Mcp-Session-Id`, does not keep SSE clients, and does not advertise `/mcp/message`.

Supported endpoints:

- `GET /health`: health probe.
- `POST /mcp`: JSON-RPC request/notification endpoint.
- `GET /mcp`: `405 Method Not Allowed`.
- `/mcp/message`: `404 not_found`.

The ACP descriptor is always:

```json
{
  "name": "zotero",
  "type": "http",
  "url": "http://127.0.0.1:<port>/mcp",
  "headers": [{ "name": "Authorization", "value": "Bearer <token>" }],
  "enabled": true
}
```

If the backend does not advertise HTTP MCP support, the adapter records `zotero_mcp_unavailable` and does not inject Zotero MCP. SSE capability is no longer used as a fallback.

## Tool Execution

`initialize`, `notifications/initialized`, and `tools/list` run immediately. `tools/call` runs through a process-local FIFO queue so multiple agent tool calls cannot concurrently enter Zotero native APIs.

All tool failures are captured and returned as JSON-RPC errors or structured MCP tool results. The socket accept loop should only close a connection after a valid HTTP response has been written.

## Diagnostics

The request ring buffer records:

- request method/path/status/auth/content headers
- JSON-RPC method/id/tool name/protocol version
- response JSON-RPC id/protocol/tool count/error
- `queueWaitMs`, `durationMs`, `toolOutcome`, and `toolErrorName`

Tokens and query secrets remain redacted.

## Tool Contracts

Existing tool names remain stable. Tool descriptions and schemas should tell agents the recommended argument shape:

- item refs: `{ "key": "...", "libraryId": 1 }` or `{ "id": 123 }`
- collection refs: `{ "collection": { "key": "...", "libraryId": 1 } }` or `{ "collectionId": 123 }`
- write tools: preview first internally, require ACP permission, then execute only after approval

JSON-string refs may be parsed for compatibility but are not recommended in descriptions.

## Broker Hardening

The broker remains the single MCP backend. Item detail, notes, and attachments should tolerate child-level Zotero API failures. If one note/attachment/file path fails, the tool should still return available DTOs plus warnings/errors instead of aborting the HTTP response.
