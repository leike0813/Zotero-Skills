# log-retention-control Specification

## Purpose
TBD - created by archiving change add-plugin-log-system. Update Purpose after archive.
## Requirements
### Requirement: Runtime Logs SHALL Be Ephemeral and Session-Scoped

Logs SHALL be persisted in plugin preferences and restored on next plugin
startup within retention constraints. Persistence SHALL use short batched writes
instead of rewriting the full persisted payload on every append.

#### Scenario: Session restart behavior

- **WHEN** plugin or Zotero restarts within retention window
- **THEN** recent runtime logs SHALL be restored from persisted payload
- **AND** expired records SHALL be pruned during hydration

#### Scenario: Append schedules batched persistence

- **WHEN** one or more runtime log entries are appended in the same short window
- **THEN** the manager SHALL coalesce them into batched prefs persistence
- **AND** it SHALL NOT require one full persisted rewrite per append

#### Scenario: Durability boundary forces flush

- **WHEN** diagnostic snapshot, bundle export, issue summary, clear, or plugin
  shutdown is requested
- **THEN** the manager SHALL flush pending runtime-log persistence before
  returning

### Requirement: Runtime Logs SHALL Enforce a Maximum Retained Entry Count of 2000
The retention system SHALL apply a mode-aware budget to bound stored diagnostics.

#### Scenario: Normal mode retention
- **WHEN** diagnostic mode is disabled
- **THEN** retention SHALL follow normal-mode entry budget (compatible with existing behavior)

#### Scenario: Diagnostic mode retention
- **WHEN** diagnostic mode is enabled
- **THEN** retention SHALL enforce dual thresholds (`3000 entries` and `20MB serialized estimate`)
- **AND** eviction SHALL remove oldest entries first

### Requirement: Retention System SHALL Track and Expose Truncation State
The system MUST maintain truncation metadata for user-visible diagnostics.

#### Scenario: Overflow occurs
- **WHEN** one or more entries are evicted due to retention limit
- **THEN** system SHALL increase dropped-entry counter
- **AND** log window SHALL display truncation notice derived from this counter

#### Scenario: Budget reason is required
- **WHEN** overflow eviction occurs
- **THEN** system SHALL record budget-hit reason (`entry_limit` or `byte_budget`) for viewer/export diagnostics

