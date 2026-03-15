## Why

Local runtime one-click deploy/uninstall currently writes diagnostic logs only to the debug console channel, and debug surfaces are always visible.  
This causes two issues:

- No durable audit trail in runtime logs for key deploy/uninstall actions.
- Debug-only controls and debug log stream are exposed in non-debug usage.

We need a split model: persistent logs for key action milestones, plus debug-console logs gated by a hardcoded debug mode.

## What Changes

- Add a hardcoded debug mode SSOT (`default=false`) and gate debug-only surfaces and debug-console log writes with it.
- Route key local-runtime one-click action logs into `runtimeLogManager` using a strict whitelist.
- Keep debug console and persistent runtime logs as separate systems.
- Exclude periodic monitoring/polling signals (heartbeat/reconcile/auto-ensure loops) from persistent logs.

## Capabilities

### New Capabilities
- `skillrunner-local-runtime-debug-mode-log-split`: Defines debug-mode gated surfaces and dual-channel local-runtime logging behavior.

## Impact

- Affects local runtime logging path in manager module.
- Affects debug deploy store behavior.
- Affects preferences visibility for debug console button.
- Affects selection sample/validate menu visibility in debug mode.
- Adds tests for whitelist filtering and debug-mode gating.
