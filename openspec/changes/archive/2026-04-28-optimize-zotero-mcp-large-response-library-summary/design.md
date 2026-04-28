# Design

## Response Size Policy
MCP tools that can return unbounded data must default to bounded summaries. Full content must be requested by stable object ref and returned in explicit chunks. This directly addresses the reported `get_item_notes` large-response termination.

## Library Summary Tool
`zotero.list_library_items` is the preferred scan/index tool. It returns regular top-level items only, with parent item keys and lightweight metadata. It supports cursor pagination so agents can iterate serially.

The cursor is an opaque numeric string offset for v1. Results are sorted by numeric item id for deterministic pagination in tests and real runtime.

## Note Body Tool
`zotero.get_item_notes` lists note summaries. `zotero.get_note_detail` reads one note body chunk at a time:

- default `format="text"`
- default `maxChars=8000`
- max `maxChars=16000`
- `nextOffset` is supplied when more content exists

This makes large note reads resumable and keeps each MCP response small.

## Error And Verification Guidance
Write tools keep their permission flow. Successful write results include `verificationHint` so agents know to verify state with `get_item_detail` or `list_library_items` when clients report transport-level failures after server execution.

Not found errors for item, note, and collection are structured so clients do not see generic `fetch failed`.
