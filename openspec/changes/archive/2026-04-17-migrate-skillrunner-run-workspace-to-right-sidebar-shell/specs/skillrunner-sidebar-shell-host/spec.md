## ADDED Requirements

### Requirement: SkillRunner sidebar host MUST integrate with Zotero native right shells
The plugin MUST mount SkillRunner as a native right-shell page in both the library item pane and the reader context pane.

#### Scenario: open Skill-Runner in library right shell
- **WHEN** user opens Skill-Runner from a library-window entry point
- **THEN** the plugin MUST activate the library right-shell SkillRunner host
- **AND** the host MUST render the shared global run workspace frontend inside the Zotero right pane

#### Scenario: open Skill-Runner in reader right shell
- **WHEN** user opens Skill-Runner from a reader-window entry point
- **THEN** the plugin MUST activate the reader right-shell SkillRunner host
- **AND** the host MUST render the same shared global run workspace frontend inside the reader context pane

### Requirement: SkillRunner sidebar host MUST support open, toggle, close, and fallback semantics
The plugin MUST expose explicit sidebar host entry semantics and MUST restore the previous native pane state when SkillRunner is closed.

#### Scenario: toggle from main toolbar reuses existing host state
- **WHEN** user clicks the main-toolbar Skill-Runner button
- **THEN** the plugin MUST toggle the SkillRunner sidebar host instead of always forcing open
- **AND** if the host is currently active the plugin MUST close it and restore the previously active native pane mode

#### Scenario: explicit open routes to sidebar host first
- **WHEN** Dashboard, request-created automation, or another explicit run-entry path opens SkillRunner
- **THEN** the plugin MUST route to the sidebar host first
- **AND** the host MUST select the requested task when a task target is provided

#### Scenario: sidebar host failure falls back to legacy dialog
- **WHEN** the sidebar host cannot be injected or initialized in the current Zotero window
- **THEN** the plugin MUST fall back to the legacy run dialog
- **AND** the plugin MUST preserve task selection semantics for the requested run

### Requirement: SkillRunner sidebar host MUST provide a direct action bridge and live context refresh
The sidebar host MUST maintain a direct host-action bridge for the embedded page and MUST refresh sidebar context as Zotero selection changes.

#### Scenario: embedded page action uses direct host bridge
- **WHEN** the embedded SkillRunner page sends a sidebar action such as `select-task`, `toggle-drawer`, or `close-sidebar`
- **THEN** the host MUST handle the action through the direct bridge before any postMessage fallback
- **AND** the host MUST push a refreshed workspace snapshot after the action changes sidebar state

#### Scenario: selection change refreshes sidebar context without reopening
- **WHEN** the current library selection or reader context changes while the SkillRunner sidebar is active
- **THEN** the host MUST recompute the current parent-item context
- **AND** the host MUST refresh related-task indicators, running-task shortcuts, and auto-focus decisions without requiring the user to reopen the sidebar
