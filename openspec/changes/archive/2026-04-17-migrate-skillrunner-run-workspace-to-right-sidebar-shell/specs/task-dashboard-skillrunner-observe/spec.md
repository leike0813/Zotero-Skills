## ADDED Requirements

### Requirement: SkillRunner observation entry points MUST route to the sidebar workspace first
The plugin MUST prefer the SkillRunner sidebar workspace for interactive observation and only fall back to the legacy run dialog when the sidebar host is unavailable.

#### Scenario: dashboard open-run targets sidebar workspace
- **WHEN** user opens a SkillRunner task from Dashboard
- **THEN** the plugin MUST open or focus the SkillRunner sidebar workspace first
- **AND** the workspace MUST select the requested task session

#### Scenario: interactive request-created targets sidebar workspace
- **WHEN** a SkillRunner interactive request emits `request-created`
- **THEN** the plugin MUST route the foreground observation surface to the SkillRunner sidebar workspace
- **AND** the workspace MUST focus the newly created task session unless sidebar host initialization fails

### Requirement: Sidebar observation surfaces MUST reflect parent-item-related running tasks
The sidebar observation UI MUST expose current-parent-item-related running tasks separately from the full drawer while keeping relatedness logic bound to parent items only.

#### Scenario: top shortcut strip shows related running tasks only
- **WHEN** the sidebar workspace renders current-context shortcuts
- **THEN** it MUST include only running tasks whose `targetParentID` matches the current primary parent item
- **AND** each shortcut MUST show the workflow name only
- **AND** succeeded, failed, canceled, disabled, or requestId-less tasks MUST NOT appear in the shortcut strip

#### Scenario: selection-driven auto-focus only applies to non-terminal related tasks
- **WHEN** the current parent-item selection changes while the sidebar workspace is active
- **THEN** the plugin MUST auto-focus only non-terminal tasks related to the new primary parent item
- **AND** if the currently focused task remains within the related non-terminal set the plugin MUST keep focus unchanged
