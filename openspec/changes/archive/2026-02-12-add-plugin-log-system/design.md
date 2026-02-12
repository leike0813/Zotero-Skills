## Context

Current plugin diagnostics are fragmented across alert dialogs and console output. As workflows now involve multi-stage execution (selection filtering, request compilation, provider calls, polling, applyResult), users cannot reliably recover complete error context from existing UI surfaces.

This change introduces a first-class in-plugin logging system focused on:
- observability during workflow execution,
- reproducible bug reporting,
- low operational overhead (runtime memory only, no persistence).

Constraints:
- Must fit existing Zotero plugin UI model (menu-triggered dialogs/windows).
- Must not introduce heavy external dependencies.
- Must prevent unbounded memory growth in long sessions.

## Goals / Non-Goals

**Goals:**
- Add a unified in-memory runtime log pipeline with structured entries.
- Add a dedicated log window accessible from plugin menu.
- Default log view shows **all levels** while supporting level-based filtering.
- Capture trigger-level and job-level events, including actionable error details.
- Provide copy/export-friendly output for issue reporting and agent debugging.
- Enforce bounded retention with deterministic truncation.

**Non-Goals:**
- No persistent on-disk logging in this change.
- No remote telemetry upload.
- No full-text search engine or complex log analytics.
- No replacement of existing alert summary UX (alerts remain; logs are complementary).

## Decisions

### Decision 1: Introduce a centralized `runtimeLogManager` module

Create a new core module that exposes:
- `append(entry)` for normalized log writes,
- `list(filters)` for window rendering,
- `clear()` for manual reset,
- `snapshot()` for copy/export.

Log entry schema (normalized):
- `ts` (ISO timestamp),
- `level` (`debug` | `info` | `warn` | `error`),
- `scope` (`workflow-trigger` | `job` | `provider` | `hook` | `system`),
- `workflowId`, `requestId`, `jobId` (optional),
- `stage` (short machine-readable stage label),
- `message` (human-readable summary),
- `details` (JSON-serializable object),
- `error` (normalized `{ name, message, stack }` when present).

Rationale:
- one append/read contract avoids ad-hoc string logging across modules,
- structured fields enable filtering and copy-ready diagnostics.

Alternative considered:
- writing directly to Zotero debug console only.
  - Rejected: hard for end users to collect complete traces; often truncated or unavailable.

### Decision 2: Log window defaults to “All levels” with optional level filters

UI behavior:
- default selection: show all levels (`debug/info/warn/error`),
- toggle filters for level and optional scope/workflow,
- reverse-chronological list with concise row summary and expandable details section,
- actions: `Copy Selected`, `Copy Visible`, `Copy All`, `Clear`.
- runtime write policy default: `debug` level is disabled by default; `info/warn/error` are recorded by default.

Rationale:
- default-all avoids hidden diagnostics during triage,
- filters preserve usability when log volume grows.

Alternative considered:
- default `warn/error` only.
  - Rejected by product decision; risks hiding context needed to diagnose causality.

### Decision 3: Instrument workflow lifecycle at existing high-value boundaries

Insert logging at:
- workflow trigger start/end,
- input filtering and unit splitting,
- per-job buildRequest / provider dispatch / poll / applyResult boundaries,
- caught exceptions and failure summaries.

Rationale:
- maximizes debugging value without logging every internal line.

Alternative considered:
- verbose per-function trace logging.
  - Rejected: noise-heavy and unnecessary for first version.

### Decision 4: Bounded in-memory retention with ring-buffer semantics

Retention policy:
- maintain fixed max entries (`2,000` in v1),
- on append overflow, drop oldest entries,
- maintain dropped counter for diagnostics (e.g., `droppedEntries`),
- expose truncation notice in log window header.

Rationale:
- deterministic memory bound,
- simple implementation and predictable UX.

Alternative considered:
- time-window eviction only.
  - Rejected: session-specific burst traffic can still exceed memory goals.

### Decision 5: Copy/export format uses normalized JSON text

Copy/export output:
- default copy/export format: pretty JSON array,
- keep NDJSON as optional action for machine-oriented workflows,
- includes normalized error stacks and key metadata fields.

Rationale:
- machine-parseable and LLM-friendly,
- no ambiguity from localized plain-text formatting.

Alternative considered:
- plain-text only.
  - Rejected: weak for downstream automated analysis.

## Risks / Trade-offs

- [Risk] Increased runtime overhead from logging in hot paths  
  → Mitigation: lightweight normalization, avoid deep cloning large payloads by default, cap `details` size.

- [Risk] Sensitive data accidentally copied into logs  
  → Mitigation: redact known auth headers/tokens and large binary blobs before append.

- [Risk] Log UI becomes cluttered under heavy execution volume  
  → Mitigation: default compact row rendering + filters + truncation indicator.

- [Risk] Inconsistent logging style across modules  
  → Mitigation: provide small helper wrappers (`logWorkflow`, `logJob`, `logProviderError`) and enforce via code review/tests.

## Migration Plan

1. Add `runtimeLogManager` and global bridge utilities.
2. Add log window module and menu entry (`Workflow Logs...`).
3. Instrument workflow execution and job queue boundary points.
4. Add i18n strings for window labels/actions in `en-US` and `zh-CN`.
5. Add tests for retention/truncation, filter behavior, and key lifecycle logging.
6. Validate with type check/build and focused integration tests.

Rollback:
- remove menu entry and bypass logger append calls; execution path remains functionally intact.

## Open Questions

- Whether to expose a user preference toggle for `debug` logging in a follow-up change.
