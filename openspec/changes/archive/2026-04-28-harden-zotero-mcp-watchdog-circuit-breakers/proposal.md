# Harden Zotero MCP Watchdog And Circuit Breakers

## Summary

Harden the embedded Zotero MCP server beyond the current Streamable HTTP and FIFO queue baseline. The server should turn runtime failures into structured JSON-RPC errors, expose guard diagnostics, and recover from request-level failures where possible.

## Motivation

Recent ACP agent testing still reports `fetch failed`, `terminated`, and MCP disconnection after some Zotero tool failures. Existing protection serializes `tools/call` and catches most protocol-level handler exceptions, but it does not yet cover running tool timeouts, request listener fatal errors, circuit breaking, or restart/watchdog state.

## Key Changes

- Add MCP guard state with running timeout, active tool, restart counters, stale descriptor flag, and per-tool circuit breaker snapshots.
- Add running tool timeout with JSON-RPC error `zotero_mcp_tool_timeout`.
- Add request-level fallback responses so listener failures try to return JSON-RPC internal errors instead of closing the transport silently.
- Add per-tool circuit breakers that temporarily reject repeatedly failing tools with `zotero_mcp_tool_circuit_open`.
- Add watchdog restart behavior for stopped/error sockets and fatal listener errors.
- Add `zotero.get_mcp_status` as a non-queued read-only diagnostic MCP tool.
- Harden read tools and broker DTO serialization so notes/attachments child failures become warnings/errors or structured not-found errors.

## Out of Scope

- Legacy SSE transport restoration.
- Remote attachment download endpoints.
- Changing write-tool permission flow.
- Replacing the existing FIFO queue policy.
