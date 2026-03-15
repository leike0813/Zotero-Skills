## MODIFIED Requirements

### Requirement: Dashboard backend log panel MUST provide human-readable context filters
The log dashboard MUST resolve technical backend and workflow identifiers into human-readable display names and labels during filtering.

#### Scenario: Display human-readable filter labels
- **WHEN** user views active filter scope or filter dropdowns
- **THEN** technical identifiers (IDs) MUST be mapped to their corresponding Display Names (for Backends) or Labels (for Workflows)
- **AND** localized strings MUST be used for all UI actions and status confirmations
