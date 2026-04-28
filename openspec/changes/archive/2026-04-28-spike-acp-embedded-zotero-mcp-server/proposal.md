## Why

ACP global chat needs a path for agents to query live Zotero context without launching a separate MCP server process. A small embedded localhost MCP HTTP server can validate whether OpenCode ACP can discover and call Zotero-owned tools directly from the plugin runtime.

## What Changes

- Add a spike-only embedded MCP HTTP server bound to `127.0.0.1` from the Zotero plugin runtime.
- Expose minimal endpoints: `GET /health`, Streamable HTTP `POST /mcp`, and the legacy SSE `/mcp` + `/mcp/message` pair needed by OpenCode ACP when using an ACP `type: "sse"` descriptor.
- Implement a minimal MCP JSON-RPC subset for `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`.
- Add one read-only tool, `zotero.get_current_view`, backed by the existing ACP host context builder.
- Inject the embedded server into ACP `session/new`, `session/load`, and `session/resume`, preferring ACP SSE transport when the backend advertises it because the real Zotero socket path is verified there.
- Surface MCP startup, request, tool call, injection, and failure diagnostics without blocking ACP chat when the server is unavailable.

## Capabilities

### New Capabilities

- `acp-embedded-zotero-mcp-server`: Embedded Zotero MCP HTTP spike, minimal tool contract, ACP injection, and diagnostics.

### Modified Capabilities

- None.

## Impact

- ACP connection/session setup and diagnostics.
- New embedded MCP server/runtime modules.
- ACP diagnostics bundle content.
- Node tests for MCP JSON-RPC handling, official MCP SDK Streamable HTTP compatibility, ACP MCP descriptor injection, and a real OpenCode ACP + Zotero runtime smoke test.
