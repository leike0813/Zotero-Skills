# Proposal: tag-regulator-live-reconcile-for-controlled-and-staged-tags

## Why
`tag-regulator` currently consumes backend `suggest_tags` as if they were still fresh when the result arrives. In real use, local controlled vocabulary and staged inbox may already have changed after submission, especially when multiple tasks run in parallel or users accept earlier suggestions before later tasks finish.

That creates two bad outcomes:

- stale suggestions that already entered controlled vocabulary still appear in the suggest dialog
- stale suggestions that already entered staged inbox are reminded again even though they were already deferred

The plugin should keep using submission-time controlled vocabulary for backend reasoning, but it must classify suggestions against the latest local state before prompting the user.

## What Changes
- add a live reconcile step in `tag-regulator` result application before suggest-intake dialog opens
- reclassify returned `suggest_tags` into:
  - `reclassified_add_tags` when the tag is already in controlled vocabulary at result time
  - `reclassified_staged` when the tag is already in staged inbox at result time
  - remaining unresolved suggestions that still need dialog handling
- fold `reclassified_add_tags` into the same `add_tags` mutation path for parent items
- keep dialog-stage join/stage dedupe logic as a second guard
- add unit and mock e2e coverage for stale-controlled and stale-staged cases

## Impact
- no backend protocol change
- `applyResult` observable payload gains `reclassified_add_tags` and `reclassified_staged`
- suggest dialog becomes quieter and reflects current local state instead of submission snapshot
