# Tasks

## OpenSpec

- [x] Create proposal/design/tasks/spec artifacts for `add-acp-multi-backend-sessions-and-manager`.

## Backend Registry and Manager

- [x] Change builtin ACP backend upsert to seed-only when `acp-opencode` is absent.
- [x] Add ACP provider section and ACP-specific row fields to Backend Manager.
- [x] Persist ACP command/args/env and validate command presence.
- [x] Ensure removing ACP backend tears down its ACP slot and clears only its transcript.

## ACP Runtime

- [x] Replace single global adapter/snapshot state with backend-keyed session slots.
- [x] Persist and restore active backend id.
- [x] Add frontend snapshot APIs and active backend switch action.
- [x] Route existing ACP actions to the active backend.
- [x] Keep diagnostics, permission handling, streaming throttles, and persistence per slot.

## UI

- [x] Add backend selector to ACP sidebar.
- [x] Add Manage Backends action to More menu.
- [x] Update Dashboard ACP card aggregate summary.
- [x] Remove OpenCode-only labels where ACP/backend-generic labels are required.

## Tests

- [x] Add/adjust core tests for ACP backend manager fields, seed-only builtin behavior, slot isolation, active switch routing, and targeted clear.
- [x] Add/adjust UI smoke tests for backend selector, active backend switching, manager action, and aggregate dashboard card.
- [x] Run `npm run test:node:raw:core`.
- [x] Run `npm run test:node:raw:ui`.
- [x] Run `npx tsc --noEmit`.
