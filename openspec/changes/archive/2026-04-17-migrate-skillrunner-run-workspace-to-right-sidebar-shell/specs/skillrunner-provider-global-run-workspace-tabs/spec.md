## MODIFIED Requirements

### Requirement: SkillRunner run details SHALL be routed to a global singleton workspace
All “open run details” actions for SkillRunner tasks SHALL target one global run workspace hosted primarily inside the Zotero right sidebar shell.

#### Scenario: open when workspace is closed
- **WHEN** user opens run details for a SkillRunner task and the sidebar workspace is closed
- **THEN** the system SHALL open the SkillRunner sidebar workspace
- **AND** the workspace SHALL select and focus the target task session

#### Scenario: open when workspace is already open
- **WHEN** user opens run details for a SkillRunner task and the sidebar workspace is already open
- **THEN** the system SHALL focus the existing sidebar workspace host
- **AND** the workspace SHALL switch to the target task session
- **AND** the system SHALL NOT open another run-details window

#### Scenario: fallback when sidebar host is unavailable
- **WHEN** user opens run details for a SkillRunner task and the sidebar host cannot be initialized
- **THEN** the system SHALL fall back to the existing run-details dialog
- **AND** the fallback dialog SHALL select and focus the target task session

### Requirement: Workspace right panel SHALL preserve existing run-detail interaction model
The run workspace detail panel SHALL preserve the existing run-detail interaction model while operating inside the sidebar shell.

#### Scenario: selected task session actions
- **WHEN** user submits reply, cancel, or auth-import in the sidebar workspace detail panel
- **THEN** the action SHALL target the currently selected task session
- **AND** the action protocol SHALL remain compatible with the existing run-dialog host bridge contract

#### Scenario: close action restores native shell state
- **WHEN** user closes SkillRunner from the sidebar workspace global toolbar
- **THEN** the system SHALL close the sidebar workspace
- **AND** the system SHALL restore the native right-shell mode that was active before SkillRunner opened

## ADDED Requirements

### Requirement: Run workspace task navigation SHALL use sidebar-oriented task surfaces grouped by backend profile
SkillRunner tasks SHALL be exposed through sidebar-oriented navigation surfaces that fit a narrow right shell while preserving backend grouping.

#### Scenario: running and completed task drawer sections
- **WHEN** the sidebar task drawer renders tasks for a backend profile
- **THEN** running tasks SHALL appear in a `Running` section grouped by backend profile
- **AND** succeeded tasks SHALL appear in a `Completed` section grouped by backend profile
- **AND** the `Completed` section SHALL be collapsed by default
- **AND** failed, canceled, disabled, or requestId-less placeholder tasks SHALL NOT appear in the sidebar task drawer

#### Scenario: current parent item shortcut strip
- **WHEN** the current library or reader context resolves a primary parent item
- **THEN** the workspace SHALL expose a top shortcut strip for running tasks related to that parent item
- **AND** each shortcut SHALL display only the workflow title
- **AND** selecting a shortcut SHALL switch the global workspace to that task session

#### Scenario: task title fallback in sidebar navigation
- **WHEN** a sidebar task label is resolved
- **THEN** the system SHALL use `taskName`, fallback to `workflowLabel`, then `requestId`
- **AND** only selectable tasks with requestId SHALL be interactive in sidebar navigation