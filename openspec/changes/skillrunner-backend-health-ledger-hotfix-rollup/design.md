# Design: skillrunner-backend-health-ledger-hotfix-rollup

## 1. Scope

This change captures already-implemented hotfixes that span:

- backend health probe candidate construction
- dashboard backend/tab rendering behavior
- backend profile lifecycle cleanup and ID stability
- local managed backend reachability handoff after lease acquisition

No protocol changes and no new user-facing entry points are introduced.

## 2. Backend Health Candidate Rules

### 2.1 Registry candidates

Health probing tracks all configured `skillrunner` backend profiles from backend registry.

### 2.2 Managed-local candidate supplement

When local runtime state contains `managedBackendId + baseUrl`, probe candidates include that managed local backend even if backend registry does not currently contain the profile entry.

Rationale: avoid unmanaged health blind spots during transient profile/config windows.

## 3. Reachability Gating Defaults

### 3.1 Initial registration state

Newly registered backend health entries start as:

- `reachable = false`
- `reconcileFlag = true`

They become reachable only after first successful probe.

### 3.2 Managed-local lease shortcut

When local managed backend lease acquisition succeeds, health state is marked success immediately to avoid waiting one probe cycle.

## 4. Dashboard Rendering Guarantees

### 4.1 Backend tab source

Dashboard backend tabs are derived from configured backend registry only. History/active task rows must not synthesize backend tabs.

### 4.2 Immediate tab visibility

Dashboard refresh pipeline re-loads backend registry before snapshot push, so newly added backend profiles appear without waiting for unrelated task events.

### 4.3 Scroll stability

Backend task table scroll position is preserved per backend tab key across snapshot refreshes for both generic-http and skillrunner backend views.

### 4.4 Unavailable label localization

Unavailable badge must resolve to localized text; raw i18n keys must not render in sidebar.

## 5. Backend Removal Cleanup Contract

Deleting a backend profile must purge all backend-scoped runtime traces:

1. in-memory/persisted reconcile contexts (`skillRunnerDeferredTasksJson`)
2. active task store rows for that backend request set
3. dashboard history rows for that backend request set
4. request-ledger records for that backend
5. session sync loops and backend health tracking state

This prevents stale request reappearance when endpoint-equivalent profiles are re-added.

## 6. Internal ID Stability Contract

Backend internal IDs are generated with non-reuse bias (nonce-bearing candidate generation), so delete/re-add does not naturally reclaim prior IDs.

This supports ledger/task lifecycle isolation by profile identity.
