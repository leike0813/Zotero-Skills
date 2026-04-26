# Design

## Session Model

ACP runtime becomes a backend-keyed slot registry. Each `AcpSessionSlot` owns one backend snapshot, adapter, event subscriptions, streaming item ids, permission resolver, and emit/persist timers. The frontend maintains one `activeBackendId`; switching active backend changes the visible snapshot and command target but does not close other connected slots.

Slots are lazy. A backend slot is created when the sidebar needs to display it, connect it, or send to it. Connecting one backend must not initialize other ACP processes.

## Persistence

Existing per-backend transcript storage remains keyed by `conversation:<backendId>`. A small ACP frontend state record stores `activeBackendId`. Clearing a conversation only removes rows for the target backend request id.

## Backend Manager

Backend Manager gains an ACP provider section with fields tailored to process backends:

- `displayName`
- `command`
- `args` as newline-separated arguments
- `env` as newline-separated `KEY=VALUE`

ACP rows do not show `baseUrl`, auth, timeout, SkillRunner management, or model-cache actions. Existing HTTP/SkillRunner rows keep their current behavior.

Builtin `acp-opencode` is seeded only when absent. Existing user-edited `acp-opencode` config must not be overwritten.

## Sidebar

The ACP sidebar receives an `AcpFrontendSnapshot` containing all backend summaries and the active backend snapshot. Existing chat rendering continues to consume the active snapshot fields. A compact backend selector is placed in the header summary. The More menu opens Backend Manager.

Dashboard ACP entry summarizes active backend, connected count, error count, and total local messages.
