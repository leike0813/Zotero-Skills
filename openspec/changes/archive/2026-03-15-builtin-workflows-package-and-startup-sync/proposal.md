## Why

Plugin workflows are externally loaded from `workflowDir`, which means a fresh install may not automatically have the built-in workflow set available in runtime.

We need a stable built-in delivery path that is version-bound to plugin releases, while preserving user ownership of `workflowDir`.

## What Changes

- Package `workflows_builtin/**` into plugin release artifacts.
- Add startup sync that force-overwrites local built-in workflow target directory.
- Keep user workflow directory untouched.
- Clarify runtime path semantics in docs:
  - built-in target directory
  - user workflow directory default calculation
  - `.env` `ZOTERO_PLUGIN_DATA_DIR` -> `Zotero.DataDirectory.dir` runtime chain
- Remove preferences hints that can drift from runtime reality (built-in sync directory interpolation and placeholder copy).
- Upgrade workflow registry scanning from single-directory to dual-directory merge:
  - built-in directory + user `workflowDir`
  - user workflow keeps precedence on same workflow id.

## Capabilities

### Added Capabilities
- `builtin-workflow-package-and-sync`

### Updated Capabilities
- `task-runtime-ui`

## Impact

- Affects startup workflow initialization path.
- Affects workflow registry load semantics and source precedence.
- Adds built-in workflow source metadata for dashboard rendering.
