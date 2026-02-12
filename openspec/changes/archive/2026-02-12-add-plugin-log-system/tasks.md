## 1. Runtime Log Infrastructure

- [x] 1.1 Add a centralized in-memory runtime log manager module with normalized log entry schema
- [x] 1.2 Implement append/list/clear/snapshot APIs and level gating policy (default: record info/warn/error, skip debug)
- [x] 1.3 Implement sensitive field redaction for auth/token-like fields before log storage

## 2. Workflow and Job Lifecycle Instrumentation

- [x] 2.1 Add trigger-level logs at workflow execution start/end with workflow context metadata
- [x] 2.2 Add per-job boundary logs for build/dispatch/poll/apply stages with correlation ids
- [x] 2.3 Add normalized error logging for caught exceptions and failure summaries

## 3. Log Viewer Window and Menu Entry

- [x] 3.1 Add a dedicated log window module and plugin menu entry to open it from workflow menu
- [x] 3.2 Implement default “all levels visible” UI state and level filter controls
- [x] 3.3 Implement copy actions (`Copy Selected`, `Copy Visible`, `Copy All`) with default Pretty JSON Array output
- [x] 3.4 Add optional NDJSON export/copy action for machine-oriented workflows

## 4. Retention and Memory Bound Control

- [x] 4.1 Implement bounded retention with fixed max 2000 entries and oldest-first eviction
- [x] 4.2 Track dropped-entry count and expose truncation metadata to the log window
- [x] 4.3 Display truncation notice in log viewer when evictions have occurred

## 5. i18n, Tests, and Verification

- [x] 5.1 Add locale entries for log menu item, log window labels, filter controls, and copy actions (`en-US`, `zh-CN`)
- [x] 5.2 Add tests for log manager behavior (schema normalization, level gating, redaction, retention eviction)
- [x] 5.3 Add tests for log viewer behavior (default all-level visibility, filtering, copy output format)
- [x] 5.4 Add tests for workflow/job instrumentation coverage at key execution boundaries
- [x] 5.5 Run type check and build validation (`npm run build`) after implementation
