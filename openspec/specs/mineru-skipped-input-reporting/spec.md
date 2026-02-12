# mineru-skipped-input-reporting Specification

## Purpose
TBD - created by archiving change fix-mineru-idempotent-md-input-filter. Update Purpose after archive.
## Requirements
### Requirement: MinerU Execution Result SHALL Report Skipped Input Units Caused by Idempotent Filtering
The execution summary for `mineru` SHALL report how many input units were skipped by pre-submission idempotent filtering.

#### Scenario: Partial skip is reflected in summary
- **WHEN** a trigger contains both executable and idempotent-conflicting PDF inputs
- **THEN** execution summary SHALL include `skipped > 0`
- **AND** skipped count SHALL equal the number of conflicted inputs removed before submission

#### Scenario: All inputs skipped by idempotent filtering
- **WHEN** all candidate PDF inputs are filtered out because same-name markdown targets already exist
- **THEN** the trigger SHALL end without provider job execution
- **AND** execution summary SHALL report skipped count equal to total candidate input units

### Requirement: MinerU ApplyResult SHALL NOT Create Duplicate Linked Markdown Attachments for Same Parent and Same Path
Even if an input bypasses pre-submission filtering, result apply MUST avoid adding duplicate linked markdown attachments that point to the same file path under the same parent item.

#### Scenario: Same parent already has linked markdown attachment to target path
- **WHEN** applyResult determines target markdown path `<pdfBaseName>.md` and parent already has an attachment linked to that exact path
- **THEN** applyResult SHALL NOT create another linked attachment for the same path
- **AND** existing linked attachment SHALL be retained as-is

