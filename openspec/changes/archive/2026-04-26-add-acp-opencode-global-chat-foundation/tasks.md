## 1. OpenSpec And Contracts

- [x] 1.1 Rewrite the ACP change artifacts so phase 1 is defined as an observable, interactive OpenCode sidebar MVP.
- [x] 1.2 Keep ACP backend defaults and tests aligned with `reference/vscode-acp` by using `npx opencode-ai@latest acp`.

## 2. ACP Runtime Projection

- [x] 2.1 Extend the ACP adapter with diagnostics, authentication, permission, mode, and model controls.
- [x] 2.2 Refactor the ACP session manager into a structured projection layer for session updates, diagnostics, local persistence, lifecycle state, and visible close/stderr metadata.
- [x] 2.3 Preserve ACP storage path resolution, add `sessionCwd`, and keep ACP excluded from workflow execution paths.

## 3. Sidebar MVP

- [x] 3.1 Upgrade the ACP sidebar snapshot/view-model to expose agent/session metadata, mode/model state, host context, diagnostics, and permission/auth actions.
- [x] 3.2 Upgrade the ACP chat page so users can observe connection state, inspect diagnostics, render thought/tool/plan items, and control mode/model/auth/permission.
- [x] 3.3 Keep the Dashboard ACP entry as a sidebar launcher while reflecting the richer ACP status model.
- [x] 3.4 Replace ACP sidebar `postMessage`-only actions with an injected Zotero sidebar bridge and keep `postMessage` only as fallback.

## 4. Verification

- [x] 4.1 Expand ACP node tests to cover lifecycle observability, auth retry, permission confirmation, mode/model control, unexpected close diagnostics, and `sessionCwd` persistence.
- [x] 4.2 Expand ACP UI smoke coverage for diagnostics, auth/permission controls, picker actions, and injected sidebar bridge wiring.
- [x] 4.3 Add ACP transport coverage for Windows `npx` command wrapping and npm shim resolution.
- [x] 4.4 Run `npm run test:node:core`, `npm run test:node:ui`, and `npx tsc --noEmit`.

## 5. Diagnostics Feedback Loop

- [x] 5.1 Add structured ACP diagnostics with stack, stage, code/data, and raw error metadata.
- [x] 5.2 Add JSON-RPC trace events and staged NDJSON stream errors.
- [x] 5.3 Add a copyable ACP diagnostics bundle from the sidebar.
- [x] 5.4 Re-run `npm run test:node:core`, `npm run test:node:ui`, and `npx tsc --noEmit`.
