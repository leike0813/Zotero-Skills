## Why

Plugin i18n has drifted across runtime modules and locale files: key ownership is unclear, duplicate keys exist across files, and fallback behavior is inconsistent (notably local backend display name and runtime toasts).  
We need a single governance contract to keep locale behavior stable as features continue to evolve.

## What Changes

- Introduce a localization governance SSOT for key ownership, compatibility aliases, and fallback invariants.
- Standardize locale key ownership by file:
  - `addon.ftl`: runtime-facing strings (dashboard, toasts, backend display names).
  - `preferences.ftl`: preferences-only UI strings.
  - `mainWindow.ftl`: main window/menu entry strings.
- Add compatibility alias policy for duplicate keys during migration, then phase out aliases in follow-up cleanup.
- Add shared runtime fallback helper and require managed local backend display/toast paths to use it.
- Add automated governance check script and integrate it into CI gate flow.

## Capabilities

### New Capabilities
- `plugin-localization-governance`: Defines localization SSOT rules for key ownership, fallback behavior, compatibility aliases, and automated validation.

### Modified Capabilities
- `skillrunner-local-runtime-ui-adjustments`: Clarify that local backend display name/toast text must follow centralized localization fallback policy.

## Impact

- Affects locale resources in `addon/locale/**`.
- Affects runtime localization call sites in backend display and local runtime toast paths.
- Adds governance validator under `scripts/` and wires it into CI gate execution.
- Adds/updates core tests for legacy managed backend display name mapping and locale-aware toast fallback.
