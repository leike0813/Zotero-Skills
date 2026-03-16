## MODIFIED Requirements

### Requirement: SkillRunner backend list and gating MUST reflect configured profile lifecycle

Dashboard and reconcile behavior MUST track configured backend profile lifecycle deterministically.

#### Scenario: removed backend does not persist as dashboard tab

- **WHEN** a backend profile is removed from backend registry
- **THEN** dashboard backend tabs MUST stop showing that backend immediately after refresh
- **AND** removed backend MUST NOT reappear via synthetic/history task row aggregation

#### Scenario: newly added backend appears as gated until proven reachable

- **WHEN** a new skillrunner backend profile is added to registry
- **THEN** dashboard MUST show its backend tab on next snapshot refresh
- **AND** the backend MUST be treated as unreachable/gated until health probe success
- **AND** after first successful probe it MAY become interactable

### Requirement: backend-scoped local state MUST be purged on profile deletion

Deleting a backend profile MUST remove backend-scoped local runtime traces.

#### Scenario: delete then re-add endpoint-equivalent backend does not revive old tasks

- **WHEN** backend profile `A` is deleted
- **THEN** plugin MUST purge backend-scoped reconcile contexts, request-ledger records, and task/history projections for `A`
- **AND** if user later adds a new backend profile pointing to the same endpoint
- **THEN** old tasks from deleted profile `A` MUST NOT reappear

### Requirement: local managed backend reachability handoff MUST be immediate after lease success

Managed local backend health view MUST not wait for next probe cycle once lease acquisition confirms runtime ownership.

#### Scenario: lease-acquired local backend is marked reachable immediately

- **WHEN** local managed backend completes lease acquire successfully
- **THEN** backend health state MUST be set to reachable immediately
- **AND** reconcile gating for that backend MUST be cleared without waiting a probe tick
