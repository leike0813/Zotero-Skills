# workflow-editor-host Specification

## Purpose
TBD - created by archiving change refactor-workflow-editor-framework. Update Purpose after archive.
## Requirements
### Requirement: Workflow Editor Host SHALL Manage Dialog Lifecycle Uniformly
The system SHALL provide a generic workflow editor host that owns dialog open/close, action resolution, dirty-close confirmation (for default save/cancel flows), and cleanup for local workflow editors.

#### Scenario: Custom action buttons return action id
- **WHEN** caller opens editor with custom `actions[]`
- **THEN** host SHALL render those actions as global dialog buttons
- **AND** host SHALL resolve session with explicit `actionId`
- **AND** host SHALL include serialized state in result for non-save action completion

#### Scenario: Close default action is configurable
- **WHEN** caller sets `closeActionId` and user closes the dialog without clicking explicit action buttons
- **THEN** host SHALL resolve using the configured close action id
- **AND** caller SHALL be able to apply deterministic close policy based on that action id

#### Scenario: Save/cancel compatibility remains unchanged
- **WHEN** caller does not provide custom `actions[]`
- **THEN** host SHALL preserve default Save/Cancel flow and dirty-close prompt semantics

### Requirement: Workflow Editor Host SHALL Dispatch Renderers by Renderer ID
The host SHALL resolve a renderer by workflow-provided renderer id and SHALL fail fast if renderer cannot be loaded.

#### Scenario: Renderer resolved successfully
- **WHEN** workflow invokes host with a valid renderer id
- **THEN** host SHALL load and execute the matching renderer
- **AND** renderer SHALL receive host context and mutable editor state

#### Scenario: Renderer resolution fails
- **WHEN** workflow invokes host with an unknown or broken renderer id
- **THEN** host SHALL fail the current job with explicit renderer-load error
- **AND** no payload write SHALL be performed

### Requirement: Workflow Editor Host SHALL Process Multi-Input Sessions Sequentially
For a single workflow trigger that resolves multiple legal inputs, host-managed editor sessions SHALL be opened one-by-one in deterministic order.

#### Scenario: Multi-input sequential flow
- **WHEN** workflow trigger includes multiple editor targets
- **THEN** host SHALL open exactly one dialog at a time
- **AND** next dialog SHALL open only after previous session is resolved

