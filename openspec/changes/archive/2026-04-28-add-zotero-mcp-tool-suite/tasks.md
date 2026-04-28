## 1. OpenSpec and Docs

- [x] Create the `zotero-mcp-tool-suite` spec.
- [x] Update the Host Capability Broker SSOT with the formal MCP tools and attachment access contract.

## 2. MCP Protocol

- [x] Refactor `zoteroMcpProtocol` to use a tool registry for `tools/list` and `tools/call`.
- [x] Add broker-backed read tools for current view, selected items, search, detail, notes, and attachments.
- [x] Add attachment access DTO wrapping for MCP attachment results.
- [x] Add broker-backed mutation preview and permission-gated write tools.

## 3. MCP Server and ACP Bridge

- [x] Add MCP write permission hook support to the embedded server.
- [x] Wire MCP write permission requests to the existing ACP sidebar permission flow.
- [x] Preserve MCP diagnostics and tool-call counting for all tools.

## 4. Tests and Validation

- [x] Add core tests for tool registry listing and read tool outputs.
- [x] Add core tests for attachment access DTOs and no-content attachment behavior.
- [x] Add core tests for mutation preview, approved execution, denied execution, and missing permission hook behavior.
- [x] Add or update MCP SDK compatibility coverage.
- [x] Run `openspec status --change "add-zotero-mcp-tool-suite"`.
- [x] Run `openspec instructions proposal --change "add-zotero-mcp-tool-suite"`.
- [x] Run targeted core tests and `npx tsc --noEmit`.
- [x] Run full `npm run test:node:raw:core` or record unrelated blockers.

Known blocker: full core still fails in `test/core/70b-skillrunner-task-reconciler-apply-bundle-retry.test.ts` on the two existing bundle-apply assertions where no note is created. The Zotero MCP tool suite tests, broker tests, OpenSpec checks, and TypeScript check pass.
