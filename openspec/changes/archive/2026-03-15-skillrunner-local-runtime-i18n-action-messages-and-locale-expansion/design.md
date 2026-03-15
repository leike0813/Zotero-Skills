## Context

Preferences local-runtime status text currently uses:

- one generic working key (`pref-skillrunner-local-status-working`)
- direct `result.message` output for many user-visible outcomes

This causes poor action clarity and mixed-language UX.

## Goals / Non-Goals

**Goals**

- Action-specific in-progress status text in local-runtime action flows.
- Stage-first localization for user-visible local-runtime results.
- 4-locale governance hard gate and full locale files (`en/zh/ja/fr`).

**Non-Goals**

- Translate internal debug logs.
- Rename existing external prefs event APIs.
- Change runtime manager action semantics.

## Decisions

### Decision 1: Action-specific working status keys

- Add dedicated keys for:
  - working deploy
  - working start
  - working stop
  - working uninstall
- Keep generic `pref-skillrunner-local-status-working` as compatibility fallback only.

### Decision 2: Stage-first result localization

- Add a centralized stage-to-key resolver in preferences local-runtime status formatter.
- Render priority:
  1) localized stage message
  2) existing response `message`
  3) localized unknown fallback
- Keep existing `ok/conflict/failed` prefix behavior unchanged.

### Decision 3: Governance expands to four locales

- Extend locale coverage list in validator from two locales to:
  - `en-US`
  - `zh-CN`
  - `ja-JP`
  - `fr-FR`
- Enforce per-file parity against `en-US` for:
  - `addon.ftl`
  - `preferences.ftl`

### Decision 4: Required keys include local-runtime action/status mapping additions

- Keep current required managed-backend display/toast keys.
- Add required local-runtime action/status keys introduced by this change to prevent silent key drift.

## Risks / Trade-offs

- Full 4-locale parity raises short-term maintenance cost.
  - Mitigation: strict CI gate and centralized required-key set.
- Stage mapping can miss future stages.
  - Mitigation: compatibility fallback keeps behavior stable while preserving localizable default path.
