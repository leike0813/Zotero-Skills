## Context

The project now treats `hostApi` as the future-facing Host Capability Broker for workflows and MCP tools. The existing `handlers` module remains valuable because it provides limited, tested mutation primitives around Zotero save transactions, field validation, tags, notes, attachments, and collections. However, exposing those primitives directly to MCP would couple agent-facing tools to raw Zotero objects and bypass permission policy.

## Decision

Add an additive broker surface to `WorkflowHostApi` instead of refactoring `handlers`.

- `hostApi.context` exposes current Zotero view and selection as JSON-safe DTOs.
- `hostApi.library` exposes bounded item search and item detail/note/attachment DTOs.
- `hostApi.mutations` exposes `preview(request)` and `execute(request)` for a small allowlist of write commands.
- `handlers` remains the internal mutation backend for execute paths.
- MCP tools must use the broker surface and must not directly expose `handlers.*`.

## Mutation Boundary

`preview(request)` performs operation normalization, item/collection/note resolution, validation, and summary generation without writing Zotero state. It always returns `requiresConfirmation: true` for supported write operations.

`execute(request)` runs the same validation, then delegates to existing handler primitives. The caller is responsible for permission confirmation before execute. This keeps host API independent from the ACP permission UI while giving MCP adapters a clear `preview -> permission -> execute` flow.

## Compatibility

The change is additive. Existing workflow packages can keep using `runtime.handlers` and raw `hostApi.items.*`. The broker surface is intended for new workflow package development and MCP tools that need serialized DTOs and controlled writes.

## Out of Scope

- Full Zotero JavaScript API facade.
- MCP tool expansion beyond routing the existing `zotero.get_current_view` through the broker.
- Permission UI implementation.
- Bulk archival, destructive delete, PDF parsing, note semantic extraction, or workflow/task integration.
