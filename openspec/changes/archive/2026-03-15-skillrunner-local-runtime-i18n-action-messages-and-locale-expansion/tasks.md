## 1. OpenSpec Artifacts

- [x] 1.1 Create `proposal/design/spec/tasks` for `skillrunner-local-runtime-i18n-action-messages-and-locale-expansion`
- [x] 1.2 Add spec deltas for `plugin-localization-governance` and `skillrunner-local-runtime-ui-adjustments`

## 2. Local Runtime Action/Result Localization

- [x] 2.1 Add action-specific in-progress status keys and wire deploy/start/stop/uninstall flows
- [x] 2.2 Add stage-first local-runtime result message resolver in preferences status formatter
- [x] 2.3 Keep compatibility fallback chain (`stage-localized -> message -> unknown`)

## 3. Locale Expansion

- [x] 3.1 Add `addon/locale/ja-JP` with full `addon.ftl/preferences.ftl` coverage
- [x] 3.2 Add `addon/locale/fr-FR` with full `addon.ftl/preferences.ftl` coverage
- [x] 3.3 Add new local-runtime action/result keys in all four locales

## 4. Governance Hard Gate Upgrade

- [x] 4.1 Upgrade localization governance validator to four-locale parity checks
- [x] 4.2 Extend required-key assertions to include new local-runtime action/result keys
- [x] 4.3 Keep duplicate-key allowlist and helper wiring checks working for all locales

## 5. Tests and Validation

- [x] 5.1 Update UI tests for action-specific working text and stage-localized result rendering
- [x] 5.2 Run `npx tsc --noEmit`
- [x] 5.3 Run `npm run check:localization-governance`
- [x] 5.4 Run targeted tests:
  - `test/ui/40-gui-preferences-menu-scan.test.ts`
- [x] 5.5 Run `openspec validate skillrunner-local-runtime-i18n-action-messages-and-locale-expansion --type change --strict --no-interactive`
