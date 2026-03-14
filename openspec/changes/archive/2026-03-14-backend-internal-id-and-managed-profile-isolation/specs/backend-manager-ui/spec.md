# backend-manager-ui Specification Delta

## ADDED Requirements

### Requirement: Backend Internal ID And Display Name Separation
Backend profiles SHALL use immutable internal IDs for runtime binding and editable display names for user-visible labels.

#### Scenario: Legacy profile migration
- **WHEN** backend config entries have `id` but no `displayName`
- **THEN** plugin SHALL set `displayName = old.id`
- **AND** plugin SHALL generate a new unique internal `id`

### Requirement: Managed Local Backend Isolation
Backend manager SHALL hide managed local backend entries in both legacy and new managed IDs.

#### Scenario: Hide managed local backend
- **WHEN** backend manager renders backend rows
- **THEN** entries with ID `local-skillrunner-backend` or legacy `skillrunner-local` (managed legacy) SHALL NOT be shown in backend manager

