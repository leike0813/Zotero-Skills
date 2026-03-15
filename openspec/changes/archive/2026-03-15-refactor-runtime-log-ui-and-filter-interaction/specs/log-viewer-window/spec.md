## ADDED Requirements

### Requirement: Log Viewer Window SHALL Support Multi-select Backend and Workflow Filtering
The log viewer SHALL allow users to select multiple backends and workflows simultaneously using checkbox-based filters.

#### Scenario: Multi-select filtering
- **WHEN** user selects multiple backends via checkboxes
- **THEN** the log list SHALL display entries matching any of the selected backends
- **AND** the trigger labels SHALL reflect selection count or "All" if no filter is applied

### Requirement: Log Viewer UI Interaction SHALL Be Stable During Background Updates
Interactive components like filter dropdowns (custom-select) SHALL NOT be closed or reset when the log list or dashboard state refreshes in the background.

#### Scenario: Background refresh stability
- **WHEN** a background log update occurs while a filter dropdown is open
- **THEN** the dropdown SHALL remain open and maintain its current selection state

### Requirement: Log Viewer SHALL Provide Action Feedback (Toasts)
The log viewer SHALL provide immediate visible feedback for critical success/failure actions, such as copying data to the clipboard.

#### Scenario: Copy success feedback
- **WHEN** user successfully copies logs or diagnostic bundles
- **THEN** the UI SHALL display a transient toast notification confirming the action
