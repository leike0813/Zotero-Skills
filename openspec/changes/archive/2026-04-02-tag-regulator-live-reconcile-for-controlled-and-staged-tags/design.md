# Design: tag-regulator-live-reconcile-for-controlled-and-staged-tags

## Decision
The plugin will reconcile backend `suggest_tags` against the latest local controlled vocabulary and staged inbox immediately before suggest-intake starts.

This keeps the current backend contract intact:

- submission-time controlled vocabulary remains the backend reasoning snapshot
- result-time local state becomes the front-end classification truth

## Result Reconcile Model
After parsing a valid backend result:

1. read latest controlled vocabulary
2. read latest staged inbox
3. partition returned `suggest_tags` into three buckets:
   - `nowControlled`
   - `nowStaged`
   - `remainingSuggest`

### nowControlled
- removed from suggest dialog input
- exposed as `reclassified_add_tags`
- merged into effective `add_tags` before item mutation

### nowStaged
- removed from suggest dialog input
- exposed as `reclassified_staged`
- not written again and not promoted to `add_tags`

### remainingSuggest
- passed into existing suggest-intake dialog flow unchanged

## Mutation Ownership
`applyTagMutations()` remains the only parent-item tag mutation entry.

Effective add-tags become:

`backend add_tags + reclassified_add_tags`

This preserves idempotency because `applyTagMutations()` already skips tags that are already present on the item.

## Dialog / Intake Contract
- suggest dialog only receives `remainingSuggest`
- row/global join/stage actions continue to re-check current local state before writing
- existing close-policy staging behavior remains unchanged

## Observability
`applyResult` returns:

- `suggest_tags`: only unresolved suggestions after live reconcile
- `reclassified_add_tags`
- `reclassified_staged`

Runtime logging adds a `suggest-live-reconcile` hook-stage log with counts for those three buckets.
