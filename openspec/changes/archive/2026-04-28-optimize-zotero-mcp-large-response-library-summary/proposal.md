# Optimize Zotero MCP Large Response And Library Summary

## Summary
Reduce MCP transport failures caused by large Zotero responses and add a low-risk library index tool. The change keeps Streamable HTTP and the existing FIFO queue policy, but shifts high-risk read tools to pagination/chunking so agents can inspect Zotero state without triggering `terminated` or `fetch failed`.

## Motivation
The latest Zotero MCP test report sections 9 and 10 show:

- `get_item_notes` can return 90KB+ and cause client-side `terminated`.
- parallel calls are unreliable; most parallel batches only deliver the first request.
- write operations can succeed server-side while the client reports `fetch failed`, so agents need verification guidance.
- agents lack a light way to enumerate parent item keys for a library or collection.

## Proposed Changes
- Add `zotero.list_library_items` for paged parent-item summaries with library, collection, tag, type, and query filters.
- Change `zotero.get_item_notes` to return note summaries/excerpts by default, not full note HTML.
- Add `zotero.get_note_detail` for chunked note body reads by note ref.
- Add verification hints to write tool results and tool descriptions.
- Document large-response and serial-calling guidance in the Host Capability Broker SSOT.

## Out Of Scope
- No legacy SSE transport.
- No remote attachment download endpoint.
- No change to queue/circuit-breaker defaults.
- No MCP resource streaming; note body transfer remains JSON chunks.
