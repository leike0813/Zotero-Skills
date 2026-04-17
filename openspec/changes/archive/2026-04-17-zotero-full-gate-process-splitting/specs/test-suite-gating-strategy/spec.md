## ADDED Requirements

### Requirement: Zotero full MAY run as sequential real-host domain segments

Release gating SHALL continue to use the `full` suite. Zotero real-host `full`
execution SHALL support sequential multi-process execution instead of requiring
one monolithic process.

#### Scenario: Release gate runs Zotero full as sequential real-host segments

- **WHEN** a release gate runs the Zotero `full` suite
- **THEN** it MAY execute `full` as multiple sequential real-host processes
- **AND** the default retained execution topology SHALL run:
  - `core:full`
  - `ui:full`
  - `workflow:full`
- **AND** failure in any segment SHALL fail the overall `full` gate

#### Scenario: Process splitting does not shrink full coverage

- **WHEN** Zotero `full` is executed as sequential segments
- **THEN** membership and gating semantics SHALL remain identical to the
  retained `full` suite contract
- **AND** process splitting SHALL be treated as an execution-topology change,
  not a coverage reduction
