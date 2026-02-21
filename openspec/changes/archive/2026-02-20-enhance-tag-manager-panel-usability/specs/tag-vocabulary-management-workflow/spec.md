## ADDED Requirements

### Requirement: Tag manager facet column SHALL be read-only in panel editing
The workflow UI MUST display each entry facet as a non-editable field and SHALL NOT provide direct facet mutation controls in the panel.

#### Scenario: Facet is visible but not editable
- **WHEN** user opens the tag manager panel and views any row
- **THEN** system SHALL show facet value in the facet column
- **AND** system SHALL NOT render facet as a selectable dropdown for row editing

#### Scenario: Save path keeps protocol validation
- **WHEN** user edits other fields and saves
- **THEN** system SHALL keep running existing facet/tag consistency validation
- **AND** invalid facet/tag combinations SHALL still fail deterministically

### Requirement: Tag manager panel SHALL provide sticky table headers
The workflow UI MUST render a visible column header row that remains visible while scrolling the entry list.

#### Scenario: Header remains visible during list scrolling
- **WHEN** the panel contains enough rows to scroll
- **THEN** system SHALL keep the header row visible at the top of the scroll container
- **AND** users SHALL be able to identify each column meaning while browsing lower rows

### Requirement: Export action SHALL produce visible deterministic output
The workflow UI MUST provide user-visible export output and keep the exported content aligned with the protocol export contract.

#### Scenario: Export generates visible result
- **WHEN** user clicks Export
- **THEN** system SHALL render the exported `facet:value` lines in a visible read-only area
- **AND** output SHALL be copy-ready for downstream `tag-regulator` usage

#### Scenario: Export content follows protocol order and shape
- **WHEN** vocabulary content is unchanged
- **THEN** exported content SHALL remain deterministic in order
- **AND** output SHALL include tag strings only without note/source/deprecated metadata

#### Scenario: Export remains copy-first
- **WHEN** user views export result
- **THEN** system SHALL keep the exported text directly copyable
- **AND** downstream usage SHALL not depend on file-download controls

### Requirement: Search input SHALL retain focus during incremental filtering
The workflow UI MUST keep search typing uninterrupted while applying incremental filters.

#### Scenario: Incremental typing does not lose focus
- **WHEN** user types multiple consecutive characters into search input
- **THEN** search input SHALL remain focused after each state update
- **AND** user SHALL continue typing without re-clicking the input

### Requirement: Tag manager SHALL support combinational facet filtering via popup panel
The workflow UI MUST provide a popup filter sub-window containing per-facet multi-select controls that can be combined across all configured facets.

#### Scenario: Filter button opens popup sub-window
- **WHEN** user clicks the filter button in toolbar
- **THEN** system SHALL open an internal popup filter panel
- **AND** panel SHALL contain grouped controls for all configured facets

#### Scenario: Facet options are derived dynamically
- **WHEN** vocabulary entries change
- **THEN** each facet filter control SHALL show options derived from current entries under that facet
- **AND** unavailable values SHALL NOT be listed

#### Scenario: Multi-facet selections combine deterministically
- **WHEN** user selects multiple facet values across different facet controls
- **THEN** system SHALL apply combined filtering to the row list
- **AND** filtering SHALL compose with text search results deterministically
