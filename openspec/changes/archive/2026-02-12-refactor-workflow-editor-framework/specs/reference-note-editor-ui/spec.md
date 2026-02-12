## ADDED Requirements

### Requirement: Reference Editor UI SHALL Use Compact Row Layout
The renderer SHALL present each reference as a compact row-strip layout with row index on the left and row actions on the right.

#### Scenario: Row layout is compact and actionable
- **WHEN** editor renders reference rows
- **THEN** each row SHALL display index at left
- **AND** up/down/delete actions SHALL be inline at right
- **AND** row controls SHALL not consume a separate dedicated line

### Requirement: Reference Editor UI SHALL Keep Raw Text Visible and Editable
The renderer SHALL always show raw text editor for each row and SHALL keep its content readable and editable.

#### Scenario: Raw text field visibility
- **WHEN** editor renders any reference row
- **THEN** row SHALL include an editable raw-text field
- **AND** field content SHALL be visible in viewport without hidden-text rendering defect

### Requirement: Reference Editor UI SHALL Optimize Field Proportions for Editing
The renderer SHALL allocate larger width to title and compact width to year/citekey fields, while hiding editable ID from default form area.

#### Scenario: Field width distribution
- **WHEN** editor row is displayed
- **THEN** title input SHALL be the dominant width field
- **AND** year and citekey inputs SHALL use compact widths
- **AND** editable ID field SHALL not appear in default visible form

### Requirement: Reference Editor UI SHALL Provide Usable Window Size and Scroll Behavior
The editor window SHALL open with a usable default size and minimum size, and long reference lists SHALL be edited through a clearly visible vertical scroll area.

#### Scenario: Large reference set editing
- **WHEN** reference list exceeds visible area
- **THEN** editor SHALL keep toolbar and primary controls usable
- **AND** list area SHALL scroll vertically in an obvious container
- **AND** window SHALL not expand unbounded to fit all rows

