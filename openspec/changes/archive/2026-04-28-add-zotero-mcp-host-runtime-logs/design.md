# Design: Zotero MCP Host Runtime Logs

## Runtime Log Source

MCP logs reuse `runtimeLogManager` instead of introducing a separate file writer. Entries use:

- `scope: "system"`
- `component: "zotero-mcp"`
- `operation`: a lifecycle stage such as `request.accepted`, `tool.started`, or `response.write.failed`
- `requestId`: a locally generated request id
- `phase`: broad phase such as `request`, `tool`, or `response`

This gives MCP diagnostics the same retention, redaction, export, and filtering behavior as existing runtime logs.

## Lifecycle Coverage

The server records enough stages to localize failures:

- Request: `request.accepted`, `request.parsed`, `request.fatal`
- Tool: `tool.resolved`, `queue.accepted`, `tool.started`, `tool.finished`, `tool.failed`
- Response: `response.serialize.started`, `response.serialize.finished`, `response.serialize.failed`, `response.write.started`, `response.write.finished`, `response.write.failed`

High-volume success stages may be `debug` or `info`; all failure stages must be `warn` or `error`.

## Safety

Logs must not store Authorization headers, bearer tokens, request bodies, response bodies, or full local attachment paths. They may store:

- JSON-RPC id, method, and tool name
- sanitized request path
- response byte length
- duration, queue position/wait, outcome, and error name/message

## Health And Status

`getZoteroMcpHealthSnapshot()` includes a compact recent log summary: last MCP request id, last log stage, last log error name, and whether response write failed. `zotero.get_mcp_status` includes the latest safe MCP runtime log summaries so agents can report server-side evidence when tools fail.

## UI Boundary

The ACP MCP LED renders `mcpHealth.state`, `mcpHealth.severity`, `mcpHealth.summary`, and host-provided tooltip text. Raw `mcpServer.recentRequests` and diagnostics remain available in the diagnostics bundle, but they should not drive the primary LED state when `mcpHealth` exists.
