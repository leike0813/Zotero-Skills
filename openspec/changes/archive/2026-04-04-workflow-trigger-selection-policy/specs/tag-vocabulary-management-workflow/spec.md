## ADDED Requirements

### Requirement: Tag manager SHALL be triggerable without selection
The `tag-manager` workflow MUST be explicitly launchable even when Zotero starts with no selected items.

#### Scenario: Launch tag manager with empty selection
- **WHEN** the user triggers `tag-manager` while `getSelectedItems()` is empty
- **THEN** workflow execution SHALL proceed without a `no selection` rejection
- **AND** the tag manager editor SHALL open normally
- **AND** save/discard behavior SHALL remain unchanged from the selected-item path
