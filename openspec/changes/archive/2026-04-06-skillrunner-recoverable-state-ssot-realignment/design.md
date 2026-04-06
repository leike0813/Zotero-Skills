# Design: skillrunner-recoverable-state-ssot-realignment

## 1. Core Decision

This change repairs implementation drift back to the current SSOT:

1. `requestId` not yet created: local dispatch failure may still be terminal
   `failed`.
2. `requestId` already created: local transport/observation failure is only a
   recoverable plugin-side diagnostic.
3. Only backend double-confirmed terminal state may write terminal `failed`.
4. No new user-visible status is introduced.

## 2. Queue and Foreground Summary

### 2.1 Job queue catch-path

When provider dispatch throws after `request-created`:

- keep `job.error`
- preserve non-terminal state (`running` fallback)
- emit recoverable dispatch failure log
- do not write queue terminal `failed`

### 2.2 Apply seam classification

Foreground apply summary treats a SkillRunner job as pending when:

- provider is `skillrunner`
- `requestId` already exists
- local state is active or legacy speculative `failed`

For `auto` mode, that pending item remains reconciler-owned.

## 3. Reconciler Upsert Guard

`registerFromJob()` becomes requestId-aware for speculative local failures:

- if incoming job is a recoverable dispatch failure
- and existing context is non-terminal
- preserve existing non-terminal state instead of downgrading to `failed`

If no existing context exists, create one with non-terminal fallback `running`.

## 4. SSOT Alignment

This change tightens two existing contracts:

- local post-create transport failure is not backend terminal failure
- backend terminal failure still requires jobs double-confirm

No change is made to:

- events/history -> SSE ownership of non-terminal backend states
- jobs double-confirm ownership of terminal convergence
- user-visible state enumeration

## 5. Non-goals

- no backend protocol changes
- no new persistent schema
- no new dashboard status labels
