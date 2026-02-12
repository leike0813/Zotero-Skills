# reference-note-source-locator-rendering Specification

## Purpose
TBD - created by archiving change enhance-reference-note-editor-metadata-and-table-columns. Update Purpose after archive.
## Requirements
### Requirement: Reference Note Table Rendering MUST Include Source and Locator Columns
Canonical references table rendering SHALL include two new columns: `Source` and `Locator`.

#### Scenario: Rewrite references note table
- **WHEN** any workflow rewrites a references note table (`literature-digest`, `reference-matching`, or `reference-note-editor`)
- **THEN** rendered table header SHALL include `Source` and `Locator` columns
- **AND** the row data for these columns SHALL be derived from payload fields using canonical mapping rules

### Requirement: Source Column MUST Use Deterministic Field Precedence
`Source` SHALL render the first non-empty field value in this order: `publicationTitle`, `conferenceName`, `university`, `archiveID`.

#### Scenario: Multiple source-like fields are present
- **WHEN** a reference row contains more than one non-empty source candidate field
- **THEN** renderer SHALL choose the highest-priority non-empty field by the defined precedence
- **AND** renderer SHALL output exactly one source value in the `Source` column

### Requirement: Locator Column MUST Merge Locator Parts in Stable Order
`Locator` SHALL be rendered from non-empty values among `volume`, `issue`, `pages`, and `place`, using a deterministic join order.

#### Scenario: Partial locator fields present
- **WHEN** a reference row contains any subset of `volume`, `issue`, `pages`, and `place`
- **THEN** renderer SHALL include only non-empty parts
- **AND** output ordering SHALL be stable and deterministic across rewrites

### Requirement: Source and Locator Rendering MUST Stay Consistent Across All Reference Note Writers
All workflows that write references notes SHALL apply the same canonical rules for `Source` and `Locator` rendering.

#### Scenario: Same payload rewritten by different workflows
- **WHEN** the same references payload is rewritten by each of the three workflows (`literature-digest`, `reference-matching`, and `reference-note-editor`)
- **THEN** resulting `Source` and `Locator` cell outputs SHALL be equivalent for corresponding rows
- **AND** payload/table synchronization SHALL remain intact after each rewrite

