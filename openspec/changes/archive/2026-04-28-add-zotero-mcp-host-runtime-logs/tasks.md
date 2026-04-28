# Tasks

- [x] Add OpenSpec spec for `zotero-mcp-host-runtime-logs`.
- [x] Add MCP runtime log helpers and request id generation.
- [x] Instrument request parse, tool dispatch, queue, response serialization, and response write stages.
- [x] Add safe recent MCP runtime log summaries to server status/health snapshots.
- [x] Ensure `zotero.get_mcp_status` includes recent MCP runtime log summaries.
- [x] Simplify ACP MCP LED rendering to prefer `mcpHealth` and remove noisy raw request inference.
- [x] Add MCP server tests for success, tool failure, serialization failure, write failure, and status summaries.
- [x] Update ACP UI smoke tests.
- [x] Run validation:
  - `openspec status --change "add-zotero-mcp-host-runtime-logs"`
  - `openspec instructions proposal --change "add-zotero-mcp-host-runtime-logs"`
  - `npx mocha "test/core/101-zotero-mcp-server.test.ts" --require tsx --require test/setup/zotero-mock.ts`
  - `npx mocha "test/core/97-acp-ui-smoke.test.ts" --require tsx --require test/setup/zotero-mock.ts`
  - `npx tsc --noEmit`
