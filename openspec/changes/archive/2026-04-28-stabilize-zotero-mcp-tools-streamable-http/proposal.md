# Stabilize Zotero MCP Tools With Streamable HTTP

## Summary

Remove the legacy SSE fallback from the embedded Zotero MCP server and stabilize the formal Zotero MCP tool suite on MCP 2025-06-18 stateless Streamable HTTP. The server should be easier for ACP agents to understand from `tools/list`, and tool/backend failures must become structured MCP errors instead of client-visible transport failures such as `fetch failed` or `terminated`.

## Motivation

The latest Claude Code transcript shows that Zotero MCP injection and tool discovery succeeded, but multiple `tools/call` requests failed at the transport layer. The failures correlate with legacy SSE `/mcp` + `/mcp/message`, concurrent tool calls, and backend exceptions that were not reliably translated into MCP responses.

## Key Changes

- Make the embedded Zotero MCP server HTTP-only:
  - `POST /mcp` handles JSON-RPC.
  - `GET /mcp` returns `405 Method Not Allowed`.
  - `/mcp/message` returns `404 not_found`.
  - descriptors are always ACP `{ type: "http" }`.
- Remove SSE diagnostics and state such as `sseClientCount`.
- Serialize `tools/call` execution to protect Zotero host APIs from concurrent native calls.
- Extend request diagnostics with tool outcome, queue wait, duration, and safe error fields.
- Keep the existing Zotero tool names, but improve tool descriptions, JSON schemas, argument validation, and structured errors.
- Harden broker-backed item detail, notes, and attachments so child DTO failures become warnings/errors rather than transport failures.

## Out of Scope

- Remote attachment download endpoints.
- Full Zotero API facade.
- Direct exposure of `handlers.*`.
- Removing the existing permission-gated write tools.
