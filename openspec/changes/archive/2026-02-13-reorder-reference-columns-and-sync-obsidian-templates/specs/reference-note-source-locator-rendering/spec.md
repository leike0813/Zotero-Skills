## MODIFIED Requirements

### Requirement: Reference Note Table Rendering MUST Include Source and Locator Columns
Canonical references table rendering SHALL include two new columns: `Source` and `Locator`.

#### Scenario: Rewrite references note table
- **WHEN** any workflow rewrites a references note table (`literature-digest`, `reference-matching`, or `reference-note-editor`)
- **THEN** rendered table header SHALL include `Source` and `Locator` columns
- **AND** canonical header order SHALL be `#`, `Citekey`, `Year`, `Title`, `Authors`, `Source`, `Locator`
- **AND** row cell order SHALL match the same sequence
