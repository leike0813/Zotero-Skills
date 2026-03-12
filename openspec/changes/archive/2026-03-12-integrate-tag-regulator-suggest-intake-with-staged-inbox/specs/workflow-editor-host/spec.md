## MODIFIED Requirements

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
