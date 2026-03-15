## Why

Workflow context menu currently mixes task execution entries with utility entries (`Rescan`, `Workflow Settings`, `Open Logs`), which makes the menu heavy and duplicates navigation paths that already exist in preferences/dashboard flows.

At the same time, preferences information hierarchy still contains redundant top headings and weak section grouping, reducing scannability as more runtime controls were added.

We need to simplify workflow context entry points and strengthen preferences IA with clearer section cards.

## What Changes

- Remove `Rescan Workflows`, `Workflow Settings...`, and `Open Logs...` from workflow context menu.
- Keep workflow context menu focused on:
  - `Open Dashboard...`
  - workflow execution entries
- Move `Open Logs` entry to preferences workflow section.
- Remove top redundant preferences headings (`pref-title`, `pref-section-plugin` as top lines).
- Reorganize preferences into card-style functional sections with stronger section titles.
- Update specs and tests to match the new entry-point contract.

## Capabilities

### Updated Capabilities
- `workflow-settings-per-workflow-page`
- `log-viewer-window`

## Impact

- Affects context-menu composition in `workflowMenu` module.
- Affects preferences layout and button bindings.
- Affects workflow-menu and startup-menu UI test snapshots/assertions.
- No workflow execution protocol changes.
