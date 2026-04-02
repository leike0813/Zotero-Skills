# Design

## Core Model
- Local mode: local committed vocabulary remains the SSOT.
- Subscription mode: remote committed snapshot remains the SSOT.
- Staged entries become structured records with optional `parentBindings` and `publishState`.

## Intake Rules
- `tag-regulator` join in subscription mode performs an immediate publish transaction.
- If that publish fails, the selected tags are written into staged storage with parent bindings and a failure toast is shown.
- `tag-regulator` stage writes to staged storage and records deferred parent bindings only.
- A suggest tag is appended to parent item tags only after it successfully enters committed vocabulary.

## Parent Binding Rules
- Only staged entries originating from `tag-regulator` suggestions carry `parentBindings`.
- When the same staged tag is suggested by multiple parent items, the binding list is merged.
- `parentBindings` are deferred bindings, not proof of applied parent-tag mutation.
- After a staged batch successfully enters committed vocabulary, the tag is appended to every bound parent item and the staged record is removed.
- Stage-only paths, close-policy staging, and join fallback-to-staged paths SHALL NOT append tags to parent items.

## Feedback Rules
- Subscription-mode publish success/failure always emits a short toast.
- Failures also emit runtime logs; no silent no-op remains in the suggest dialog path.
