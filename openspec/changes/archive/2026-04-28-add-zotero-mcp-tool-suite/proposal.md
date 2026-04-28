## Why

The embedded Zotero MCP server currently exposes only `zotero.get_current_view`. Agents need a broader Zotero tool suite that can inspect library context and perform bounded writes without coupling MCP contracts to raw Zotero APIs or legacy `handlers`.

Attachment tools also need a stable contract before remote MCP access is introduced. Returning a local filesystem path is acceptable for localhost, but remote clients will need authenticated download URLs instead of direct paths.

## What Changes

- Expand the embedded Zotero MCP server to a formal broker-backed tool suite.
- Route all tools through `hostApi.context`, `hostApi.library`, and `hostApi.mutations`.
- Add read tools for current view, selection, search, item detail, notes, and attachments.
- Add mutation tools that always run `preview -> permission -> execute`.
- Add a stable attachment access DTO with local-path v1 behavior and future download-url compatibility.
- Update the Host Capability Broker SSOT with MCP tool and attachment transfer rules.

## Capabilities

### New Capabilities

- `zotero-mcp-tool-suite`: Defines the formal Zotero MCP tools, JSON-safe outputs, permission-gated mutation behavior, and attachment access contract.

### Modified Capabilities

- None.

## Impact

- Affects MCP protocol dispatch, embedded MCP server permissions, ACP MCP injection, and diagnostics.
- Adds core tests for tool listing, read tools, mutation preview/write gating, attachment access DTOs, and MCP SDK compatibility.
- Does not implement remote attachment download endpoints in this change.
