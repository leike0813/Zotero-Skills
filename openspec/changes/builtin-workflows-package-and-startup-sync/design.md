## Context

Current runtime loads workflows from user-configured `workflowDir` only.
Built-in workflows have moved to repository `workflows_builtin/` and must be delivered with releases.

## Goals / Non-Goals

**Goals**

- Built-in workflows are included in release package.
- Startup sync force-applies packaged built-ins to local built-in directory.
- Registry merges built-in + user workflows, with user id override.
- Dashboard can identify whether a loaded workflow is built-in.

**Non-Goals**

- No migration/deletion of user directory workflows.
- No hash-based user-modification detection.
- No new user-facing config toggles.

## Decisions

### Decision 1: Built-in target directory

- Built-in local target directory is `<DataDirectory>/zotero-skills/workflows_builtin`.
- If data directory is unavailable, runtime falls back to `<cwd>/.zotero-skills-runtime/workflows_builtin`.
- User workflow directory semantics remain separate:
  - `workflowDir` pref first
  - fallback to `<DataDirectory>/zotero-skills/workflows`.
- `.env` `ZOTERO_PLUGIN_DATA_DIR` is only consumed by scaffold startup and eventually maps to `Zotero.DataDirectory.dir`.

### Decision 2: Force-overwrite startup sync

- Startup runs `syncBuiltinWorkflowsOnStartup()` before registry scan.
- Sync behavior:
  - reject source/target when same path or nested paths;
  - write packaged built-ins to staging directory first;
  - replace built-in target directory from staging after full staging success;
  - stale built-in workflows not present in package are removed by replacement.
- Sync failures are logged but do not block plugin startup.
- If replacement fails, keep or restore previous built-in directory copy (no empty-directory regression).

### Decision 3: Dual-directory registry merge

- Scan both built-in target directory and user `workflowDir`.
- Merge by workflow id:
  - built-in loaded first;
  - user loaded second and overrides same id.
- Warnings are emitted for duplicate ids resolved in favor of user workflows.

### Decision 4: Built-in badge source

- Registry state stores `workflowSourceById` (`builtin|user`).
- Dashboard home workflow bubbles render built-in badge only when source is `builtin`.
- If a user workflow overrides the same id, badge disappears automatically.

## Risks / Trade-offs

- Startup sync introduces additional filesystem operations.
  - Mitigation: keep copy path deterministic and text-only.
- Dual scan may increase warning count when one directory is missing.
  - Mitigation: tests assert semantically (at least one error) rather than single fixed counts where needed.
