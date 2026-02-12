# mineru-workflow-result-materialization Specification

## Purpose
TBD - created by archiving change add-mineru-workflow. Update Purpose after archive.
## Requirements
### Requirement: MinerU Workflow SHALL Materialize Bundle Outputs Next To Source PDF
The workflow SHALL extract MinerU bundle contents and materialize outputs in the same directory as the source PDF.

#### Scenario: Rename markdown output
- **WHEN** bundle contains `full.md` and the source PDF filename is `ABC.pdf`
- **THEN** the workflow SHALL materialize markdown output as `ABC.md` in the source PDF directory

#### Scenario: Rename images directory
- **WHEN** bundle contains `images/` and source PDF item key is `XXXXXX`
- **THEN** the workflow SHALL materialize images directory as `Images_XXXXXX/` in the source PDF directory

#### Scenario: Replace orphan images directory before move
- **WHEN** `<pdfBaseName>.md` does not exist and target `Images_<itemKey>` already exists in the source PDF directory
- **THEN** the workflow SHALL delete the existing target `Images_<itemKey>` directory before moving the new images directory into place

### Requirement: MinerU Workflow SHALL Rewrite Markdown Image Paths
The workflow SHALL rewrite markdown image references from the original bundle path to the renamed images directory.

#### Scenario: Replace images prefix
- **WHEN** markdown content contains references like `images/figure-1.jpg`
- **THEN** the workflow SHALL rewrite them to `Images_<itemKey>/figure-1.jpg`

### Requirement: MinerU Workflow SHALL Attach Materialized Markdown To Parent Item
After successful materialization, the workflow SHALL link the generated markdown file as an attachment under the source PDF parent item.

#### Scenario: Add linked markdown attachment
- **WHEN** markdown file is successfully materialized
- **THEN** the workflow SHALL add it as a linked attachment to the source PDF parent item

### Requirement: MinerU Workflow SHALL Fail Fast On Missing Required Bundle Entries
The workflow SHALL report an explicit failure when required bundle entries are missing.

#### Scenario: Missing full markdown entry
- **WHEN** downloaded bundle does not contain required markdown entry (`full.md`)
- **THEN** the workflow SHALL fail that PDF unit with a clear error
- **THEN** no partial attachment SHALL be created for that failed unit

