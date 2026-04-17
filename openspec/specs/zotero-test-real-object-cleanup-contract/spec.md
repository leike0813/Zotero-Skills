# zotero-test-real-object-cleanup-contract Specification

## Purpose
TBD - created by archiving change zotero-test-real-object-cleanup-harness. Update Purpose after archive.
## Requirements
### Requirement: Real-host object cleanup MUST be centralized in a test harness

Real Zotero object cleanup MUST be implemented as shared test infrastructure
rather than duplicated ad hoc file-by-file cleanup.

#### Scenario: Handlers-created objects are tracked automatically

- **WHEN** a real Zotero test creates an item, note, attachment, or collection
  through the shared `handlers` entry points
- **THEN** the shared harness tracks the created object automatically

#### Scenario: Cleanup uses safe deletion order

- **WHEN** tracked real Zotero objects are deleted during teardown
- **THEN** child notes are deleted before attachments
- **AND** attachments are deleted before other child items
- **AND** parent items are deleted before collections

#### Scenario: Keep-objects mode skips deletion but not tracking

- **WHEN** `ZOTERO_KEEP_TEST_OBJECTS` is enabled
- **THEN** the harness skips real-object deletion during teardown
- **AND** test execution may preserve the created DB scene for debugging

