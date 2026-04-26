# Design

## Object Model

`Backend` is the user-managed ACP backend configuration. `Engine` is a live process/connection started from a backend. A single backend can have two isolated runtime lanes:

- `ChatEngineRuntime`: the engine used by global free-form chat.
- `TaskEnginePool`: the engine pool used by workflow/skill execution.

Chat and task engines do not share ACP processes. This prevents free-form conversation context, permissions, stderr, diagnostics, or transient agent state from contaminating workflow execution.

## Chat Governance

Each backend owns a chat session collection and one active chat session id. A chat session is a local conversation record with transcript, UI state, diagnostics, model/mode selections, workspace metadata, and an optional currently attached remote ACP session id.

Only the active chat session receives sidebar actions such as send, cancel, set mode, set model, permission resolution, and diagnostics toggles. Switching sessions changes the visible transcript and command target; it does not require reconnecting the backend engine unless the target session needs a new remote ACP session attachment.

The plugin remains the SSOT for chat transcript and UI state. Remote ACP `sessionId` is not durable SSOT, but it may be persisted as a recoverable attachment candidate. After plugin restart, the plugin restores local transcript/UI state and may attempt remote session restore when the backend explicitly declares `session/resume` or `session/load`; otherwise it creates a new remote ACP session on reconnect or first prompt.

## Task Governance

ACP workflow/skill execution uses a separate `TaskEnginePool` per backend. The v1 task pool is serial: one ACP task session may run per backend at a time; additional jobs wait in queue.

Each task session is bound to workflow identity and job identity: `workflowId`, `runId`, `jobId`, and provider `requestId` when available. Task sessions do not appear in the free-form chat session list. Finished task sessions are archived and can be opened read-only from task history or diagnostics.

## Workspace Governance

The model distinguishes three path types:

- `engineCwd`: cwd used to launch the ACP engine process and as the default `session/new cwd`.
- `sessionWorkspace`: plugin-managed workspace owned by a specific chat session or task session.
- `runtimeDir`: engine-level diagnostics, stderr tail, temporary state, and connection metadata.

Chat workspaces are scoped by `backendId + conversationId` and are retained long-term with the chat session. Task workspaces are scoped by `backendId + runId + jobId` and follow task history retention; the default retention is the existing 30-day task history policy.

## Restart and Recovery

On plugin restart, chat session lists, active session ids, transcripts, UI state, workspace metadata, and the last known remote session id may be restored from local storage. Remote ACP sessions are only resumed when the backend capability explicitly supports reliable `session/resume` or `session/load`; failed or unsupported restore falls back to a new session.

Task sessions are not resumed as live ACP jobs after restart in this governance change. Their archived transcript, result, and diagnostics remain available according to task history retention.

## Future Implementation Split

This SSOT intentionally precedes implementation. Follow-up changes should be split into:

- chat multi-session management under the current ACP sidebar.
- ACP task provider and task engine pool integration with workflow execution.

Remote restore is optional and capability-gated. Future `session/list` support may add remote history discovery, but local chat sessions remain the plugin-side navigation model.
