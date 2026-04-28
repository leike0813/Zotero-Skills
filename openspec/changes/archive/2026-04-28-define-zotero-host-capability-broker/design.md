# Design

## Current Architecture Facts

`handlers` is the oldest Zotero-facing abstraction in this project. It covers a limited set of write-oriented operations for items, parent items, notes, attachments, tags, collections, and a placeholder command handler. It wraps common Zotero mutation details such as id/key/item resolution, field validity checks, attachment path handling, and `saveTx`/`eraseTx` calls.

`hostApi` was introduced later as a workflow package broker. It includes broader host capabilities such as item lookup, preferences, file operations, editor sessions, notifications, logging, and aliases to handler domains. Workflow runtime currently exposes both `runtime.handlers` and `runtime.hostApi`.

This change documents that `handlers` is not a complete Zotero API facade. It does not cover search, reader state, annotations, PDF content, full-text, import/export, sync, group/library management, citation APIs, or broader Zotero UI surfaces.

## Target Layering

The stable layering is:

1. Zotero native APIs provide the raw host runtime.
2. `handlers` provide internal mutation primitives for common write operations.
3. `hostApi` provides the Host Capability Broker for workflow and MCP backends.
4. MCP Zotero tools expose JSON-safe agent-facing tool contracts over broker capabilities.

New Zotero capabilities should be modeled in `hostApi` or a broker module owned by `hostApi`, then surfaced to workflow hooks or MCP tools as separate contracts. MCP tools must not return `Zotero.Item`, `Zotero.Collection`, `nsIFile`, windows, or other host objects.

## Compatibility

`runtime.handlers` remains available for legacy workflow hooks. Removing or renaming it would break existing workflow packages and is explicitly out of scope.

New workflow packages should prefer `runtime.hostApi` because package hooks may run under a host API facade where direct `runtime.zotero` and `runtime.addon` access is intentionally unavailable.

`hostApi.parents`, `hostApi.notes`, `hostApi.attachments`, `hostApi.tags`, `hostApi.collections`, and `hostApi.command` may continue to alias `handlers` domains, but future broker work should not require MCP callers to know those internal domain names.

## MCP Boundary

MCP tools are agent-facing and should be designed around user tasks:

- `zotero.get_current_view`
- `zotero.get_selected_items`
- `zotero.search_items`
- `zotero.get_item_detail`
- `zotero.get_item_notes`
- `zotero.get_item_attachments`

The first formal tool set should be read-only. Mutation tools such as tagging, note creation, collection membership changes, or attachment writes must add explicit permission policy before exposure.

MCP outputs should be DTOs with stable identifiers, display text, and structured fields. They should include enough metadata for follow-up calls, but should not expose native objects or internal storage paths unless a tool explicitly needs a safe path result.

## Documentation Ownership

`doc/components/zotero-host-capability-broker-ssot.md` is the human-facing SSOT. The OpenSpec capability records requirements, while the doc file explains the governance model for future implementers.

The SSOT must be updated when:

- `WorkflowHostApi` public surface changes.
- `handlers` public behavior changes.
- Zotero MCP tool contracts are added, removed, or renamed.
- The permission model for MCP-exposed mutations changes.
