## Context

The plugin currently exposes multiple workflow-related actions from right-click context menu, including actions that are not required in the selection-time execution path. This weakens menu signal-to-noise ratio.

Preferences already hosts workflow directory scan and workflow options entry, and is a better home for secondary tools like log viewer entry.

## Goals / Non-Goals

**Goals**

- Keep workflow context menu execution-focused.
- Keep `Open Dashboard...` as the single utility entry in workflow context menu.
- Move log viewer entry to preferences workflow area.
- Improve preferences readability with card sections and stronger section titles.

**Non-Goals**

- No change to workflow execution protocol or settings gate behavior.
- No change to backend/provider runtime semantics.

## Decisions

### Decision 1: Context menu minimal structure

Workflow menu popup structure is fixed as:

1. `Open Dashboard...`
2. separator
3. workflow dynamic entries (or disabled empty item)

Removed entries:

- `Rescan Workflows`
- `Workflow Settings...` (submenu)
- `Open Logs...`

### Decision 2: Preferences workflow section owns log-viewer entry

Add workflow-area button in preferences:

- `Open Log Viewer`

Dispatch path:

- `addon.hooks.onPrefsEvent("openLogViewer", { window })`

### Decision 3: Preferences information architecture

Remove top standalone headings and use card-style section containers:

- Workflows
- Backends
- SkillRunner Local Runtime
- About

Card titles are rendered with stronger visual hierarchy (larger/bolder).

## Risks / Trade-offs

- Existing tests asserting old context-menu order and entries will fail.
  - Mitigation: update `ui/40` and `ui/01` assertions to new structure.

- Existing locale keys for removed context-menu labels remain in locale files.
  - Acceptable for compatibility in this change; cleanup can be handled separately.
