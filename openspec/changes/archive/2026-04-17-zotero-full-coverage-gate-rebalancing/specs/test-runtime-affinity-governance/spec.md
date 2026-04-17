## ADDED Requirements

### Requirement: Zotero full expansion SHALL prioritize stable host coverage over unstable interaction paths

Routine Zotero execution SHALL thicken `full` using stable real-host suites,
while continuing to exclude known instability classes.

#### Scenario: Stable host suites are eligible for Zotero full

- **WHEN** a suite exercises real Zotero host behavior without relying on real
  editor, picker, or brittle dialog interaction
- **THEN** it MAY be promoted into Zotero `full` to improve stable host
  coverage

#### Scenario: Known unstable interaction classes remain excluded

- **WHEN** a suite depends on editor, picker, dialog, brittle multi-realm
  override, GitHub sync, or similarly unstable interaction paths
- **THEN** it MUST remain outside routine Zotero suites even if Zotero `full`
  is being thickened
