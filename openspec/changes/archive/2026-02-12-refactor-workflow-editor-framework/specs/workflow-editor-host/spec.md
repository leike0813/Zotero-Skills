## ADDED Requirements

### Requirement: Workflow Editor Host SHALL Manage Dialog Lifecycle Uniformly
The system SHALL provide a generic workflow editor host that owns dialog open/close, save/cancel resolution, and cleanup for local workflow editors.

#### Scenario: Save closes session with payload
- **WHEN** a renderer signals save with edited payload
- **THEN** host SHALL resolve the current session as success
- **AND** host SHALL return edited payload to caller
- **AND** host SHALL close and cleanup the dialog resources

#### Scenario: Cancel closes session with failure
- **WHEN** user cancels or closes the editor dialog without save
- **THEN** host SHALL resolve the current session as failed
- **AND** host SHALL return explicit cancel reason to caller
- **AND** host SHALL close and cleanup the dialog resources

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

