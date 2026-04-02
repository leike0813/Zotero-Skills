## ADDED Requirements

### Requirement: Suggest and staged tag UIs SHALL expose parent binding counts
Workflow UIs that surface staged or stage-backed suggested tags SHALL display
the current number of bound parent items.

#### Scenario: Tag Manager staged inbox shows parent binding count
- **WHEN** a staged entry carries `parentBindings`
- **THEN** the staged inbox SHALL display the current binding count for that row

#### Scenario: Tag-Regulator suggest dialog shows staged-hit binding count
- **WHEN** a returned suggest tag already exists in staged storage
- **THEN** the suggest dialog SHALL still display that tag
- **AND** it SHALL display the merged parent binding count for that row

### Requirement: The system SHALL merge current parent bindings before the suggest dialog opens
When a returned suggest tag already exists in staged storage, the system SHALL
merge the current parent item into that staged record before the suggest dialog opens.

#### Scenario: Returned staged-hit suggest tag merges current parent
- **WHEN** `tag-regulator` receives a suggest tag that is already present in staged storage
- **THEN** the current parent item ID SHALL be merged into that staged record's `parentBindings`
- **AND** the dialog SHALL render using the merged binding count
