## Why

As workflow behaviors become more complex, users need a first-class debugging surface inside the plugin instead of relying on truncated dialogs or console fragments. A built-in log system is needed now to speed up issue triage, reproducibility, and user-agent collaborative debugging.

## What Changes

- Add an in-memory runtime logging pipeline for plugin execution events, warnings, and errors.
- Add a dedicated log window that can be opened from the plugin context menu.
- Record trigger-level and job-level execution details with structured context (workflow id, request id, stage, message, error stack when available).
- Provide user-facing copy/export actions in the log window so error traces can be shared directly in issue reports or agent prompts.
- Add bounded retention/truncation strategy to prevent unbounded memory growth during long-running sessions.
- Keep logs ephemeral (runtime-only) and clear naturally on plugin/Zotero restart.

## Capabilities

### New Capabilities

- `runtime-log-pipeline`: Unified in-memory logging channel with structured entries and level/type metadata.
- `log-viewer-window`: Dedicated window accessible from plugin menu for browsing, filtering, and copying logs.
- `log-retention-control`: Runtime retention limit and truncation policy to cap memory usage safely.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `src/modules/` (new log manager + log viewer window modules),
  - `src/modules/workflowExecute.ts` / `src/jobQueue/manager.ts` (inject workflow and job lifecycle logs),
  - `src/modules/workflowMenu.ts` and menu registration path (new “Open Logs” entry),
  - locale files (`addon/locale/**`) for log-window and action labels.
- No backend protocol changes.
- No persistent storage dependency required in this change (memory-only lifecycle).
