## Context

Workflow execution menu logic currently lives inside `workflowMenu` and is tied to the item context menu popup shape (`Open Dashboard...` + separator + workflow items).

A toolbar execution button needs the same workflow eligibility and disabled-reason logic, but a different menu shape (workflow items only).

## Goals / Non-Goals

**Goals**

- Add a toolbar `Execute Workflow` icon menu button.
- Keep execute-menu semantics equal to context-menu workflow trigger area.
- Keep Dashboard toolbar button placement unchanged.
- Keep implementation DRY via shared menu-building logic.

**Non-Goals**

- No settings-page entry changes.
- No workflow protocol or request payload changes.
- No default one-click workflow execution on toolbar button press.

## Decisions

### Decision 1: Shared workflow popup builder

- Extract popup reconstruction to exported shared function in `workflowMenu`.
- Shared function accepts `includeTaskManagerItem`:
  - `true`: context menu mode (`Open Dashboard...` + separator + workflows)
  - `false`: toolbar execute mode (workflows only)
- Disabled reason and executable checks remain identical.

### Decision 2: Toolbar dual-button layout

- Extend existing dashboard toolbar module to inject two buttons:
  - `zotero-skills-tb-execute-workflow` (new, icon menu, `icon_play.png`)
  - `zotero-skills-tb-dashboard` (existing)
- Placement:
  - Execute button inserts immediately after `zotero-tb-note-add` if present.
  - Dashboard button continues inserting before search anchor.
  - If note button is missing, execute button falls back to existing anchor strategy.

### Decision 3: Lifecycle and cleanup

- Keep existing lifecycle hooks API (`ensureDashboardToolbarButton` / `removeDashboardToolbarButton`) to avoid call-site churn.
- `ensure...` becomes idempotent for both buttons.
- `remove...` removes both buttons.

## Risks / Trade-offs

- Toolbar host structure differs across Zotero layouts.
  - Mitigation: keep existing host-resolution fallback chain and nested-anchor handling.
- Shared popup-builder changes could regress context-menu shape.
  - Mitigation: preserve current context-menu mode defaults and add explicit tests for both entrypoints.
