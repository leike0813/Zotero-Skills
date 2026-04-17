## MODIFIED Requirements

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
