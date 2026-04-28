## 1. OpenSpec and Docs

- [x] Create the `zotero-host-broker-capability-api` spec.
- [x] Update the Host Capability Broker SSOT with read/write broker API and MCP mutation rules.

## 2. Broker API

- [x] Add JSON-safe DTO and mutation request/result types to workflow host API types.
- [x] Implement broker read/context APIs for current view, selection, search, detail, notes, and attachments.
- [x] Implement mutation `preview()` for the v1 allowlist without writing Zotero state.
- [x] Implement mutation `execute()` by delegating to existing handler primitives.
- [x] Bump `WORKFLOW_HOST_API_VERSION` to v3 and include new domains in capability summaries.

## 3. MCP Bridge

- [x] Route `zotero.get_current_view` through the broker context API while keeping the output shape compatible.

## 4. Tests and Validation

- [x] Add core tests for read DTOs and JSON-safety.
- [x] Add core tests for mutation preview/execute and invalid inputs.
- [x] Add regression coverage for legacy `runtime.handlers` and existing raw `hostApi.items.*`.
- [x] Run `openspec status --change "add-zotero-host-broker-capability-api"`.
- [x] Run `openspec instructions proposal --change "add-zotero-host-broker-capability-api"`.
- [x] Run targeted core tests and `npx tsc --noEmit`.
- [ ] Run full `npm run test:node:raw:core` without unrelated failures.

Known blocker: full core currently fails in `test/core/70b-skillrunner-task-reconciler-apply-bundle-retry.test.ts` on two bundle-apply assertions where no note is created. The broker-specific tests, MCP protocol tests, hostApi v3 regression tests, and TypeScript check pass.
