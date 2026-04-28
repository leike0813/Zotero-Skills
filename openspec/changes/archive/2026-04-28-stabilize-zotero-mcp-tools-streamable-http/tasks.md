## 1. OpenSpec and Docs

- [x] Create the `zotero-mcp-tools-stability` spec.
- [x] Update the Host Capability Broker SSOT for Streamable HTTP-only MCP.

## 2. Transport

- [x] Remove legacy SSE `/mcp/message`, GET SSE stream, SSE clients, and `sseClientCount`.
- [x] Make descriptors HTTP-only and stop injecting MCP when only SSE is advertised.
- [x] Return `405` for `GET /mcp` and `404` for `/mcp/message`.

## 3. Tool Execution and Diagnostics

- [x] Serialize `tools/call` execution and record queue/duration diagnostics.
- [x] Ensure tool/backend exceptions return structured MCP errors instead of closing the connection.
- [x] Record success and failure tool-call diagnostic events.

## 4. Tool Contracts and Broker Hardening

- [x] Improve tool schema descriptions and shared argument validation.
- [x] Harden item detail, notes, and attachments against child-level Zotero API failures.
- [x] Preserve permission-gated write tools with clearer parameter contracts.

## 5. Tests and Validation

- [x] Update MCP server tests for HTTP-only behavior and no SSE status.
- [x] Add concurrent `tools/call` and thrown-tool diagnostics coverage.
- [x] Update broker tests for read-tool hardening.
- [x] Run OpenSpec checks, targeted tests, core tests, and TypeScript check.

Known blocker: full `npm run test:node:raw:core` still fails only in the pre-existing `skillrunner task reconciler: apply bundle retry` assertions where no note is created. Targeted Zotero MCP tests and TypeScript pass.
