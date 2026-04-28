## Context

The previous broker change established `hostApi` as the Host Capability Broker and kept `handlers` as internal mutation primitives. This change exposes that broker through MCP tools. The MCP boundary must stay JSON-safe, permission-aware for writes, and compatible with future remote transport.

## Tool Registry

`zoteroMcpProtocol` will use a registry of tool definitions. Each definition owns its MCP name, title, description, input schema, read/write classification, and handler. `tools/list` is generated from the registry and `tools/call` dispatches through it.

Read tools call only `hostApi.context` or `hostApi.library`. Write tools translate user-facing arguments into a `ZoteroHostMutationRequest`, call `hostApi.mutations.preview()`, request permission, and call `hostApi.mutations.execute()` only after approval.

## Permission Boundary

The MCP protocol layer accepts a `requestToolPermission` hook. If the hook is absent, unavailable, or denies the request, write tools return a structured result and do not execute. The ACP adapter wires this hook to the existing sidebar permission flow so Zotero writes are visible and user-approved.

The permission request shows the tool name and broker preview summary. The server does not accept caller-supplied confirmation tokens and does not expose `handlers.*` directly.

## Attachment Access

Attachment MCP results wrap broker attachment DTOs with:

- `access.mode`: `local-path`, `download-url`, or `unavailable`
- `access.path`: present only when the MCP client is same-host
- `access.url`: reserved for future remote download URLs
- `access.filename`, `access.contentType`, `access.size`, `access.sha256`
- `access.locality`: `same-host` or `remote`

V1 returns `local-path` for attachments with paths and `unavailable` when no file path exists. Future remote MCP can fill `download-url` using short-lived bearer-protected URLs without changing the schema.

## Out of Scope

- Remote attachment download endpoint implementation.
- Full Zotero API facade.
- Deletion, attachment writes, PDF/full-text extraction, and collection creation.
- Direct exposure of `handlers` as MCP tools.
