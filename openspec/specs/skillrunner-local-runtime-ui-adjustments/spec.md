# skillrunner-local-runtime-ui-adjustments Specification

## Purpose
TBD - created by archiving change skillrunner-oneclick-ui-adjustments. Update Purpose after archive.
## Requirements
### Requirement: One-click runtime section SHALL use icon-first status display
The preferences one-click runtime section SHALL remove user-editable version/tag input and SHALL display runtime/auto-start status via dedicated icons instead of lease/runtime text summaries.

#### Scenario: Render icon status without version input
- **WHEN** preferences page is loaded
- **THEN** the one-click section SHALL not render a version/tag input control
- **THEN** runtime LED and auto-start play icon SHALL be rendered in the same section
- **THEN** lease status text SHALL not be rendered in the one-click section

#### Scenario: Gate management/cache buttons by running state
- **WHEN** runtime snapshot state is `running`
- **THEN** `open management` and `refresh model cache` buttons SHALL be enabled
- **THEN** the buttons SHALL be disabled for non-running states

### Requirement: Runtime lifecycle events SHALL produce backend toast notifications
The runtime manager SHALL emit toast notifications for startup/shutdown/abnormal-stop lifecycle events using a dedicated backend icon type.

#### Scenario: Emit toast for up and down success
- **WHEN** runtime `up` succeeds from manual one-click or background auto-ensure paths
- **THEN** the manager SHALL emit a `runtime-up` toast
- **WHEN** runtime `down` succeeds
- **THEN** the manager SHALL emit a `runtime-down` toast

#### Scenario: Emit toast for abnormal stop reconciliation
- **WHEN** heartbeat fails and status reconciliation confirms `stopped`
- **THEN** the manager SHALL emit a `runtime-abnormal-stop` toast
- **THEN** the runtime state SHALL converge to `stopped`

#### Scenario: Deduplicate repeated toasts
- **WHEN** same toast kind is emitted repeatedly within 5 seconds
- **THEN** only the first toast SHALL be shown

### Requirement: Managed local backend SHALL use fixed identity and localized display name
The managed local backend identity SHALL be fixed for internal logic, and user-visible surfaces SHALL resolve a localized display name.

#### Scenario: Fixed backend ID with localized display text
- **WHEN** managed local backend is created or loaded
- **THEN** backend ID SHALL be `local-skillrunner-backend`
- **THEN** user-visible titles/tabs SHALL display localized name instead of raw ID

