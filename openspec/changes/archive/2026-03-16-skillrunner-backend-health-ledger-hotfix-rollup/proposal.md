# Change: skillrunner-backend-health-ledger-hotfix-rollup

## Why

Recent fixes for SkillRunner backend reachability, dashboard rendering, and backend-profile lifecycle were delivered incrementally. They are effective in code but not grouped under a single traceable OpenSpec change.

Without a consolidated change artifact:

1. Future maintenance cannot quickly understand why these hotfixes were introduced together.
2. Regression review lacks a single source for expected behaviors across backend health, dashboard tab visibility, and ledger cleanup.
3. Follow-up SSOT alignment may drift because implementation details are not explicitly captured.

## What Changes

This change documents and locks the delivered hotfix set:

1. Local managed backend is included in backend health probing even when temporarily absent from configured backend registry.
2. Dashboard backend unavailable tag uses localized text (not raw i18n key fallback leakage).
3. Backend task tables (generic-http and skillrunner) preserve per-tab scroll position during snapshot refresh.
4. Dashboard backend tab list is sourced from configured backends only (removed backends no longer persist as synthetic tabs).
5. New SkillRunner backend profiles are default-gated as unreachable until first probe success, and can appear in dashboard immediately after registry add.
6. Local managed backend marks health reachable immediately after lease acquire succeeds.
7. Backend internal IDs are hardened against reuse after delete/re-add.
8. Backend profile removal now purges backend-scoped reconcile contexts and request-ledger/task mirrors to prevent stale task resurrection.

## Impact

- No external API/event name changes.
- Internal behavior is stricter and more deterministic for backend lifecycle and state projection.
- This is a traceability and behavior-hardening change only; it does not introduce new end-user feature surface.
