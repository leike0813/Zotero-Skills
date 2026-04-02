# Design

## Core Behavior
- `tag-regulator` still filters out suggest tags that are already in committed
  controlled vocabulary.
- Suggest tags that already exist in staged storage stay visible in the dialog.
- Before the dialog opens, the current parent item is merged into the staged
  record's `parentBindings`.

## UI Rules
- `tag-regulator` suggest dialog uses a headered table-like layout.
- The dialog shows `Tag`, `Note`, `Parents`, `Join`, and `Reject`.
- `tag-manager` staged inbox adds a `Parents` column that displays
  `parentBindings.length`.

## Summary Rules
- `reclassified_staged` continues to report suggest tags that were already
  present in staged storage.
- `reclassified_staged` no longer implies those tags are hidden from the dialog.
- Returned `suggest_tags` stays protocol-compatible and does not expose dialog-only
  metadata such as `parentCount`.
