# ACP Engine / Session / Workspace Governance

## Why

ACP has reached MVP for global chat, but the current implementation still treats backend, process, session, transcript, and workspace as one practical slot. Before adding chat session management or ACP-backed workflow execution, the project needs a single governance model that defines ownership, lifecycle, persistence, and workspace boundaries.

## What Changes

- Define ACP governance terminology: `Backend`, `Engine`, `ChatEngineRuntime`, `TaskEnginePool`, `ChatSession`, `TaskSession`, `engineCwd`, `sessionWorkspace`, and `runtimeDir`.
- Split ACP usage into two isolated lanes:
  - global free-form chat, with multiple local chat sessions per backend and one active chat session per backend.
  - workflow/skill execution, with a separate per-backend serial task engine pool.
- Preserve the current chat restart semantics: restore local transcript and UI state, but do not treat remote ACP `sessionId` as durable across plugin restarts.
- Define workspace placement and retention rules for chat sessions, task sessions, and engine runtime state.
- Define that task sessions are archived for task history/diagnostics and do not appear in the free-form chat session list.

## Capabilities

### New Capabilities

- `acp-engine-session-workspace-governance`: SSOT for ACP backend, engine, session, workspace, restart, and task archive governance.

### Modified Capabilities

- None.

## Impact

- OpenSpec documentation only in this change.
- No runtime code, UI, workflow integration, provider behavior, or persisted data migration is implemented in this change.
- Future implementation changes should reference this governance model before changing ACP chat sessions or ACP task execution.
