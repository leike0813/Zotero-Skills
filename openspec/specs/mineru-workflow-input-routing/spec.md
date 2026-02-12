# mineru-workflow-input-routing Specification

## Purpose
TBD - created by archiving change add-mineru-workflow. Update Purpose after archive.
## Requirements
### Requirement: MinerU Workflow SHALL Accept PDF Inputs And Split By Attachment
The system SHALL treat each valid PDF attachment as an independent execution unit for the `mineru` workflow.

#### Scenario: Direct PDF selection
- **WHEN** the user selects one or more PDF attachments and runs `mineru`
- **THEN** the workflow SHALL create one request unit per selected PDF attachment

#### Scenario: Parent selection expansion
- **WHEN** the user selects parent items and runs `mineru`
- **THEN** the workflow SHALL discover child PDF attachments under each selected parent
- **THEN** the workflow SHALL create one request unit per discovered PDF attachment

### Requirement: MinerU Workflow SHALL Filter Markdown Target Conflicts Before Request Build
The system SHALL skip a PDF input unit before request execution only when markdown output target already exists in the PDF directory.

#### Scenario: Existing markdown target
- **WHEN** `<pdfBaseName>.md` already exists in the same directory as the source PDF
- **THEN** that PDF input unit SHALL be excluded from workflow requests

#### Scenario: Existing images directory only
- **WHEN** `Images_<pdfItemKey>` directory exists but `<pdfBaseName>.md` does not exist
- **THEN** that PDF input unit SHALL remain eligible for workflow requests

#### Scenario: Mixed valid and skipped inputs
- **WHEN** a selection contains both markdown-conflicted and markdown-conflict-free PDF units
- **THEN** the workflow SHALL execute only conflict-free units
- **THEN** the final execution summary SHALL include skipped count

