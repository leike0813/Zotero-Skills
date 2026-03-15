## Context

We already have two logging channels:

- Persistent runtime logs (`runtimeLogManager`)
- Local deploy debug console store (`skillRunnerLocalDeployDebugStore`)

Local runtime manager currently emits only to debug console store, and debug UI/menu surfaces are always shown.

## Goals / Non-Goals

**Goals**

- Persist key deploy/start/stop/uninstall milestones into runtime logs.
- Keep monitoring/polling noise out of persistent logs.
- Gate debug console logging and debug-only UI/menu surfaces by a hardcoded debug mode.

**Non-Goals**

- Add user-facing debug preferences.
- Merge the two log systems.
- Change existing runtime action APIs.

## Decisions

### Decision 1: Hardcoded debug mode single source

- Add `src/modules/debugMode.ts`.
- `isDebugModeEnabled()` returns `false` by default.
- `setDebugModeOverrideForTests()` is test-only override seam.
- No pref key and no runtime toggle UI.

### Decision 2: Persistent logging uses strict whitelist

- Extend `appendLocalRuntimeLog(...)` in local runtime manager.
- Keep existing debug-store write.
- Add runtime log write only when operation/stage is in key-action whitelist:
  - `deploy-*`
  - `oneclick-preflight`
  - `lease-acquire`
  - `uninstall-*`
- Exclude monitoring/reconcile patterns explicitly:
  - `lease-heartbeat`
  - `heartbeat-fail-reconcile`
  - `auto-ensure-*`
  - `ensure-*`

### Decision 3: Debug console channel remains independent and gated

- In debug store:
  - `appendSkillRunnerLocalDeployDebugLog` is no-op when debug mode disabled.
  - `resetSkillRunnerLocalDeployDebugSession` clears session but does not append startup entry when debug mode disabled.
- This gates both manager-side and bridge-side debug writes without changing all call sites.

### Decision 4: Debug-only UI/menu visibility

- Preferences page:
  - hide debug console button when debug mode disabled.
  - do not bind debug command listener when hidden.
- Selection sample/validate menu:
  - register only when debug mode enabled.
- Pref event `openSkillRunnerLocalDeployDebugConsole`:
  - return disabled result when debug mode is off.

## Risks / Trade-offs

- Debug mode default off can break existing tests that assumed visible debug controls.  
  → Mitigation: use explicit test override to cover both enabled and disabled paths.

- Whitelist may miss future legitimate stages.  
  → Mitigation: centralize filter helper and add tests for whitelist behavior.
