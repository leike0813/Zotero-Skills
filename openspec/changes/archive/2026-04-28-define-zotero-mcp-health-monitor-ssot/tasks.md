# Tasks

- [x] Add OpenSpec delta spec for `zotero-mcp-health-monitor`.
- [x] Add `ZoteroMcpHealthSnapshot` type and host-side derivation in `zoteroMcpServer`.
- [x] Add `mcpHealth` to ACP session and sidebar snapshots.
- [x] Update ACP chat MCP LED to use `snapshot.mcpHealth`.
- [x] Keep a narrow legacy UI fallback only for older snapshots.
- [x] Add server tests for health state derivation.
- [x] Update UI smoke tests to assert `mcpHealth` consumption and reduced raw inference.
- [x] Run validation:
  - `openspec status --change "define-zotero-mcp-health-monitor-ssot"`
  - `openspec instructions proposal --change "define-zotero-mcp-health-monitor-ssot"`
  - `npx mocha "test/core/101-zotero-mcp-server.test.ts" --require tsx --require test/setup/zotero-mock.ts`
  - `npx mocha "test/core/97-acp-ui-smoke.test.ts" --require tsx --require test/setup/zotero-mock.ts`
  - `npx tsc --noEmit`
