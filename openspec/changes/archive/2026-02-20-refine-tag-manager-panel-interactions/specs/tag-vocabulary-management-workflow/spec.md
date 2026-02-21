## ADDED Requirements

### Requirement: Tag manager facet filter SHALL be facet-only and default to all-enabled
The workflow UI MUST filter rows by facet visibility only, with all configured facets enabled by default.

#### Scenario: Initial filter state shows all facets
- **WHEN** user opens tag manager panel
- **THEN** system SHALL mark all 8 facets as selected/visible
- **AND** rows from all facets SHALL be visible before any manual uncheck

#### Scenario: Unchecked facet is excluded immediately
- **WHEN** user unchecks one or more facet options
- **THEN** rows belonging to unchecked facets SHALL be hidden immediately
- **AND** checked facets SHALL remain visible without extra apply action

### Requirement: Filter popup SHALL use instant interaction and lightweight close behavior
The filter sub-window MUST apply changes in real time and close via outside click or filter-button toggle.

#### Scenario: Popup has no action buttons
- **WHEN** filter popup is opened
- **THEN** system SHALL NOT render `Clear`, `Apply`, or `Delete` actions
- **AND** each checkbox change SHALL take effect immediately

#### Scenario: Popup closes by outside click or button toggle
- **WHEN** user clicks outside popup area or clicks `Filter` button again
- **THEN** system SHALL close popup
- **AND** already-applied filter state SHALL be preserved

### Requirement: Tag manager editing SHALL preserve list scroll position
The workflow UI MUST keep current scroll position stable during inline edits and typing updates.

#### Scenario: Typing in lower rows does not reset scroll
- **WHEN** user edits tag/note/deprecated controls in a scrolled list
- **THEN** list scroll offset SHALL remain at current position after rerender
- **AND** user SHALL NOT be forced back to top

### Requirement: Source column SHALL be read-only and Add-created entries SHALL default to manual
The workflow UI MUST lock source editing, and entries created from the panel `Add` action MUST initialize/persist source as `manual`.

#### Scenario: Source is displayed but not editable
- **WHEN** panel renders any row
- **THEN** source column SHALL be non-editable
- **AND** system SHALL NOT provide free-form source input control

#### Scenario: Add-created entry uses manual source
- **WHEN** user creates a new row via `Add` in tag-manager
- **THEN** new row source SHALL be `manual`
- **AND** saved entry SHALL keep source as `manual` unless created from non-Add flow (e.g., import)

### Requirement: Facet and Tag columns SHALL follow normalized split-edit layout
The workflow UI MUST place facet before tag, allow facet selection from enumerated options, and display/edit tag suffix only.

#### Scenario: Column order and width are adjusted
- **WHEN** panel renders table layout
- **THEN** facet column SHALL appear before tag column
- **AND** facet column width SHALL be significantly narrower than tag column (target around one-third of prior width)

#### Scenario: Facet display keeps explicit suffix separator
- **WHEN** facet column renders a row
- **THEN** UI SHALL render a half-width colon separator (`:`) beside the facet selector
- **AND** tag column SHALL NOT repeat facet prefix

#### Scenario: Facet dropdown works with bounded options
- **WHEN** user opens facet selector
- **THEN** system SHALL provide only the 8 allowed facet options
- **AND** selected facet SHALL update row facet state deterministically

#### Scenario: Tag suffix edit maps to full stored tag
- **WHEN** user edits visible tag suffix while facet is selected
- **THEN** rendered tag cell SHALL show suffix without repeated facet prefix
- **AND** serialized tag SHALL be persisted as `facet:suffix`

#### Scenario: Facet change rewrites full tag deterministically
- **WHEN** user changes facet selection for a row
- **THEN** system SHALL recompute the full tag using new facet and current visible suffix
- **AND** persisted tag SHALL always match `selectedFacet:suffix` format

### Requirement: Import controls SHALL be grouped and labeled with normalized wording
Import-related controls MUST be visually grouped and provide deterministic duplicate-strategy interaction.

#### Scenario: Import section is visually separated
- **WHEN** panel renders toolbar area
- **THEN** `Import YAML`, `Dry Run`, and `On Duplicate` controls SHALL appear in a dedicated import group
- **AND** group SHALL be visually separated from generic actions

#### Scenario: On Duplicate label and selector behavior
- **WHEN** user interacts with duplicate strategy selector
- **THEN** UI SHALL display label text `On Duplicate:` and selector values such as `Skip/Overwrite/Error`
- **AND** selected value SHALL update import strategy state reliably
