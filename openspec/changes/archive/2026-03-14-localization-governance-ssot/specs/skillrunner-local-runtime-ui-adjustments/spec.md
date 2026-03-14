## MODIFIED Requirements

### Requirement: Managed local backend SHALL use fixed identity and localized display name
The managed local backend identity SHALL be fixed for internal logic, and user-visible surfaces SHALL resolve a localized display name via centralized fallback policy.

#### Scenario: Fixed backend ID with localized display text
- **WHEN** managed local backend is created or loaded
- **THEN** backend ID SHALL be `local-skillrunner-backend`
- **THEN** legacy managed id `skillrunner-local` SHALL resolve to the same localized display-name path
- **THEN** user-visible titles/tabs SHALL display localized name instead of raw ID

### Requirement: Runtime lifecycle events SHALL produce backend toast notifications
The runtime manager SHALL emit localized toast notifications for startup/shutdown/abnormal-stop lifecycle events using governance-defined fallback behavior.

#### Scenario: Locale-aware fallback when key is unresolved
- **WHEN** runtime toast localization key is unresolved
- **THEN** toast text SHALL fallback by runtime locale (`zh`/default) via centralized helper
- **THEN** module-local fixed-English fallback SHALL NOT be used
