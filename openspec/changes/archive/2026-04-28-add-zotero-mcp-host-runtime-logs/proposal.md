## Why

Recent Zotero MCP testing reports client-visible failures such as `fetch failed`, `terminated`, and sibling tool call errors. Client-side responses do not identify whether the failure happened while reading the request, executing the tool, serializing the response, or writing the HTTP response back to the ACP agent.

The embedded MCP server needs host-side lifecycle logs so failures remain diagnosable even when the client receives no structured response. The ACP MCP LED should also render the host-derived health state without rebuilding a noisy client-side status model.

## What Changes

- Add host-side MCP request lifecycle runtime logs using the existing `runtimeLogManager`.
- Record safe lifecycle stages for MCP requests, tool execution, response serialization, and response write failures.
- Include recent MCP runtime log summaries in MCP status/health diagnostics and `zotero.get_mcp_status`.
- Simplify ACP MCP LED rendering so primary state comes from `snapshot.mcpHealth`.
- Keep existing MCP transport, queue, circuit breaker, watchdog, tool names, and permission behavior unchanged.

## Capabilities

### New Capabilities

- `zotero-mcp-host-runtime-logs`: Defines host-side runtime logging and clean health display for the embedded Zotero MCP server.

### Modified Capabilities

- None.

## Impact

- `src/modules/zoteroMcpServer.ts`: adds lifecycle logging and exposes recent MCP log summaries.
- `src/modules/zoteroMcpProtocol.ts`: returns MCP log summaries in the status tool through existing status resolver.
- `addon/content/dashboard/acp-chat.js`: simplifies MCP LED status mapping.
- `test/core/101-zotero-mcp-server.test.ts`: verifies lifecycle logs and status summaries.
- `test/core/97-acp-ui-smoke.test.ts`: verifies the UI uses host health rather than raw request inference.
