# mineru-idempotent-input-filtering Specification

## Purpose
TBD - created by archiving change fix-mineru-idempotent-md-input-filter. Update Purpose after archive.
## Requirements
### Requirement: MinerU SHALL Exclude PDF Inputs With Existing Same-Name Markdown Before Job Submission
For each candidate PDF input unit, the system SHALL check whether a same-directory, same-base-name `.md` target already exists. Inputs with existing targets MUST be excluded before jobs are submitted.

#### Scenario: All selected PDFs already have same-name markdown targets
- **WHEN** user opens the workflow menu and selected inputs for `mineru` all map to existing `<pdfBaseName>.md` files
- **THEN** `mineru` SHALL be treated as not executable for this selection
- **AND** no execution job SHALL be submitted

#### Scenario: Mixed selection with partial conflicts
- **WHEN** user selects multiple PDF inputs and only a subset maps to existing `<pdfBaseName>.md` files
- **THEN** only non-conflicting PDF inputs SHALL be converted into requests
- **AND** conflicting PDF inputs SHALL be removed from the submission set before provider execution

#### Scenario: Parent selection expansion still respects markdown conflict filtering
- **WHEN** user selects parent items and `mineru` expands them to child PDF attachments
- **THEN** conflict filtering SHALL be applied after expansion per PDF attachment
- **AND** every conflicting expanded PDF SHALL be excluded from requests

