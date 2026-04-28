# Zotero Host Capability Broker SSOT

## Why

MCP can now connect to the embedded Zotero server, so the next risk is exposing Zotero capabilities through the wrong abstraction. The project needs a single governance model that explains how legacy `handlers`, workflow `hostApi`, and future MCP tools relate before adding formal Zotero MCP tools.

## What Changes

- Define `handlers` as internal mutation primitives rather than a complete Zotero API facade.
- Define `hostApi` as the plugin's Host Capability Broker SSOT for workflow packages and MCP tool backends.
- Define MCP Zotero tools as JSON-safe agent-facing adapters over broker capabilities, not direct exports of `handlers.*` or Zotero native objects.
- Preserve legacy `runtime.handlers` for existing workflow hook compatibility while recommending `runtime.hostApi` for new workflow package development.
- Add `doc/components/zotero-host-capability-broker-ssot.md` as the project-level SSOT for future Zotero capability work.
- Add the new SSOT document to the development guide index so it is discoverable.

## Capabilities

### New Capabilities

- `zotero-host-capability-broker`: SSOT for the relationship between Zotero native APIs, handlers, workflow host API, and MCP-facing tool contracts.

### Modified Capabilities

- None.

## Impact

- OpenSpec documentation and project documentation only.
- No runtime code, UI, storage schema, MCP protocol behavior, workflow execution behavior, or handler implementation changes are included in this change.
- Future changes that add MCP Zotero tools or expand `WorkflowHostApi` should reference this SSOT.
