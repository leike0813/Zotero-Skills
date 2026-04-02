# Change Proposal

## Summary
Repair the subscription-mode handoff between `tag-regulator` and `Tag Manager` so suggest-tag intake, staged publish, and parent-item tag mutation stay consistent.

## Problem
- `tag-regulator` join actions can fail silently in subscription mode.
- Subscription-mode publish flows do not consistently emit short success/failure toasts.
- Staged suggest tags do not retain parent-item bindings, so later promotion into committed vocabulary does not backfill tags onto all affected parent items.

## Goals
- Route `tag-regulator` suggest intake through the same subscription-aware publish transaction rules used by `Tag Manager`.
- Persist staged entries with tag-regulator parent bindings.
- Apply committed tags back to all bound parent items after successful staged publish.
- Keep local mode behavior unchanged.

## Non-Goals
- No backend protocol changes.
- No new user-facing settings.
- No rollback of tags already appended to parent items after a publish failure.
