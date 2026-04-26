# Tasks

## OpenSpec

- [x] Create proposal/design/tasks/spec artifacts for `add-acp-remote-session-resume`.
- [x] Update governance wording for recoverable remote session attachments.

## Protocol and Adapter

- [x] Parse ACP initialize session restore capabilities.
- [x] Add local client methods for `session/load` and `session/resume`.
- [x] Expose restore capability flags through `AcpConnectionAdapter`.

## Runtime and Persistence

- [x] Add `remoteSessionId` and `remoteSessionRestoreStatus` to ACP snapshots and persistence.
- [x] Migrate old stored `sessionId` into `remoteSessionId` while clearing runtime `sessionId`.
- [x] Try resume/load before new session and fall back with diagnostics.
- [x] Suppress transcript duplication during `session/load` replay.

## UI

- [x] Show remote session id and restore status in sidebar details and diagnostics bundle.
- [x] Surface fallback as an explicit status item.

## Tests

- [x] Add core tests for capability parsing, resume/load order, fallback, load replay suppression, and migration.
- [x] Add UI smoke tests for remote restore status visibility.
- [x] Run `npm run test:node:raw:core`.
- [x] Run `npm run test:node:raw:ui`.
- [x] Run `npx tsc --noEmit`.
