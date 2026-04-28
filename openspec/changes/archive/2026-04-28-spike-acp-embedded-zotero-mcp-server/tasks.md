# Tasks

- [x] Create OpenSpec artifacts for `spike-acp-embedded-zotero-mcp-server`.
- [x] Add minimal MCP JSON-RPC handler for `initialize`, `tools/list`, and `tools/call`.
- [x] Add embedded localhost HTTP server singleton with bearer-token protection.
- [x] Implement `zotero.get_current_view` using existing ACP host context logic.
- [x] Inject the ACP MCP descriptor into ACP session `new/load/resume`, preferring SSE when advertised.
- [x] Add MCP diagnostics and diagnostics bundle masking/status fields.
- [x] Add recent MCP HTTP request diagnostics for OpenCode MCP connection debugging.
- [x] Keep POST JSON response mode and add minimal GET SSE compatibility for Streamable HTTP clients that probe the receive stream.
- [x] Add official MCP SDK Streamable HTTP compatibility coverage.
- [x] Stop the embedded MCP server during ACP cleanup/test reset.
- [x] Add core/UI diagnostics tests and run regression checks.
