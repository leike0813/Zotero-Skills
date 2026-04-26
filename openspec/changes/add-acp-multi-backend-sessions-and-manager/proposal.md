# ACP Multi-Backend Sessions and Manager

## Summary

Upgrade the ACP chat frontend from a single OpenCode session into a multi-backend ACP console. Users can configure multiple ACP backends, keep multiple backend sessions alive in parallel, and switch the sidebar between them without disconnecting inactive sessions.

## Goals

- Support multiple `type: "acp"` backend profiles in the Backend Manager.
- Keep ACP sessions isolated by `backendId`, including adapter, transcript, diagnostics, active streaming state, and permission resolver.
- Add a compact backend selector to the ACP sidebar and route chat actions to the active backend.
- Persist active backend selection and per-backend local transcript state.
- Preserve existing ACP protocol, transport, and workflow exclusion boundaries.

## Non-Goals

- Do not add ACP capability flags.
- Do not route ACP through workflow execution.
- Do not implement remote session restore across Zotero restarts.
- Do not auto-start all configured ACP backends.
