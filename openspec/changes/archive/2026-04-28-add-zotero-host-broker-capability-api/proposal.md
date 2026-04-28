## Why

MCP tools need to expose Zotero read and write capabilities to agents without leaking raw `Zotero.Item` objects or directly exposing legacy `handlers`. The current `hostApi` is useful for workflow packages, but it lacks a JSON-safe broker surface and an explicit preview/execute mutation boundary for permission-gated MCP writes.

## What Changes

- Extend `hostApi` into a Host Capability Broker with JSON-safe read/context domains and controlled mutation commands.
- Preserve `runtime.handlers` and existing `hostApi.items.*` behavior for legacy workflows.
- Add broker DTOs for items, notes, attachments, current view, mutation previews, and mutation results.
- Add `hostApi.context`, `hostApi.library`, and `hostApi.mutations` domains.
- Route the existing `zotero.get_current_view` MCP tool through the broker context API.
- Update the Host Capability Broker SSOT with read/write MCP exposure rules.

## Capabilities

### New Capabilities

- `zotero-host-broker-capability-api`: Defines the JSON-safe read and controlled mutation broker API exposed through `hostApi`.

### Modified Capabilities

- None.

## Impact

- Affects workflow runtime public TypeScript types and `hostApi` version.
- Adds a broker implementation module reused by workflow runtime and MCP protocol.
- Adds core tests for broker read DTOs, mutation preview/execute behavior, compatibility, and MCP current-view routing.
- Does not remove or rename `handlers`, `runtime.handlers`, or existing raw `hostApi.items.*` helpers.
