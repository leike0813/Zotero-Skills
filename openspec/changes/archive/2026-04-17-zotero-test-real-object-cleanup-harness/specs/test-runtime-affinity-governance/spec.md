## ADDED Requirements

### Requirement: Real Zotero tests MUST clean created library objects after each case

Real-host Zotero tests MUST NOT leave created parent items, notes, attachments,
or collections behind for subsequent tests.

#### Scenario: Shared teardown deletes tracked real Zotero objects

- **WHEN** a real Zotero test finishes
- **THEN** shared teardown deletes tracked library objects created during that
  test after background runtime cleanup completes

#### Scenario: Explicit direct-object creation is manually registered

- **WHEN** a real Zotero test creates Zotero items or collections directly
  without going through `handlers`
- **THEN** the test explicitly registers those objects for teardown cleanup
