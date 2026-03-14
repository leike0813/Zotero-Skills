# skillrunner-provider-global-run-workspace-tabs Specification

## Purpose
TBD - created by archiving change skillrunner-provider-global-run-workspace-tabs. Update Purpose after archive.
## Requirements
### Requirement: SkillRunner run details SHALL be routed to a global singleton workspace
All “open run details” actions for SkillRunner tasks SHALL target one global run workspace window.

#### Scenario: open when workspace is closed
- **WHEN** user opens run details for a SkillRunner task and workspace is closed
- **THEN** system SHALL open run workspace
- **AND** workspace SHALL select and focus the target task tab

#### Scenario: open when workspace is already open
- **WHEN** user opens run details for a SkillRunner task and workspace is already open
- **THEN** system SHALL focus existing workspace window
- **AND** workspace SHALL switch to the target task tab
- **AND** system SHALL NOT open another run-details window

### Requirement: Run workspace left panel SHALL group tasks by backend profile
SkillRunner tasks SHALL be grouped by backend profile with collapsible group bubbles.

#### Scenario: non-terminal and terminal buckets
- **WHEN** workspace renders tasks for a backend profile
- **THEN** non-terminal tasks SHALL render directly in the profile bubble
- **AND** terminal tasks SHALL render inside a child bubble titled “已结束任务 / Completed Tasks”
- **AND** child bubble SHALL be collapsed by default

#### Scenario: task title fallback and no-requestId behavior
- **WHEN** task tab title is resolved
- **THEN** system SHALL use `taskName`, fallback to `workflowLabel`, then `requestId`
- **AND** tasks without requestId SHALL be visible but disabled with “等待 requestId / Waiting for requestId”

### Requirement: Workspace right panel SHALL preserve existing run-detail interaction model
The right panel SHALL reuse current run-detail interaction behavior for selected task session.

#### Scenario: selected task session actions
- **WHEN** user submits reply/cancel/auth-import in run workspace
- **THEN** action SHALL target the currently selected task session
- **AND** action protocol SHALL remain compatible with existing run-dialog host bridge

