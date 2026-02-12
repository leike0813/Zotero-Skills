# log-retention-control Specification

## Purpose
TBD - created by archiving change add-plugin-log-system. Update Purpose after archive.
## Requirements
### Requirement: Runtime Logs SHALL Be Ephemeral and Session-Scoped
Logs SHALL be retained in memory only during runtime and SHALL not require persistent storage in this change.

#### Scenario: Session restart behavior
- **WHEN** plugin or Zotero restarts
- **THEN** previous runtime logs SHALL not be restored automatically

### Requirement: Runtime Logs SHALL Enforce a Maximum Retained Entry Count of 2000
The retention system SHALL bound in-memory entries to a fixed maximum of 2000.

#### Scenario: Append within limit
- **WHEN** retained entries are below 2000
- **THEN** each new entry SHALL be appended without eviction

#### Scenario: Append over limit
- **WHEN** retained entries are already 2000 and a new entry is appended
- **THEN** the oldest entry SHALL be evicted
- **AND** total retained entry count SHALL remain 2000

### Requirement: Retention System SHALL Track and Expose Truncation State
The system MUST maintain truncation metadata for user-visible diagnostics.

#### Scenario: Overflow occurs
- **WHEN** one or more entries are evicted due to retention limit
- **THEN** system SHALL increase dropped-entry counter
- **AND** log window SHALL display truncation notice derived from this counter

