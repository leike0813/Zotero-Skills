# Tasks

## OpenSpec

- [x] Create `proposal.md` for `define-zotero-host-capability-broker`.
- [x] Create `design.md` defining handlers, hostApi, and MCP tool layering.
- [x] Create `specs/zotero-host-capability-broker/spec.md` as the requirement-level SSOT.
- [x] Create `tasks.md` documenting this as an OpenSpec + documentation-only change.

## Documentation

- [x] Add `doc/components/zotero-host-capability-broker-ssot.md`.
- [x] Add the new SSOT document to `doc/dev_guide.md`.

## Validation

- [x] Run `openspec status --change "define-zotero-host-capability-broker"`.
- [x] Run `openspec instructions proposal --change "define-zotero-host-capability-broker"`.

## Non-Implementation Guardrail

- [x] Do not modify `src/` runtime, UI assets, persisted schemas, MCP runtime behavior, workflow execution behavior, or handler implementation in this change.
