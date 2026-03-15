## Why

Local runtime one-click interactions still expose two localization gaps:

- Status text at action start uses one generic message, so users cannot tell whether current action is deploy/start/stop/uninstall.
- User-visible result messages often surface internal English `message` strings directly.

At the same time, localization governance currently only hard-gates `en-US/zh-CN`, which leaves no enforceable coverage path for additional locales.

## What Changes

- Differentiate local-runtime in-progress status text by action category (deploy/start/stop/uninstall).
- Localize user-visible local-runtime result messages via stage-to-i18n mapping with compatibility fallback.
- Upgrade localization governance to 4-locale hard gate (`en-US/zh-CN/ja-JP/fr-FR`).
- Add full `ja-JP` and `fr-FR` locale resources for `addon.ftl/preferences.ftl`.

## Capabilities

### Updated Capabilities
- `plugin-localization-governance`
- `skillrunner-local-runtime-ui-adjustments`

## Impact

- Affects local runtime status rendering in preferences.
- Affects localization governance validator and CI blocking behavior.
- Adds two locale directories and full key coverage in all FTL domains.
