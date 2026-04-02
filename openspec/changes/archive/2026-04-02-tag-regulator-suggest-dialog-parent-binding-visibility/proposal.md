# Proposal

## Why
`tag-regulator` currently hides suggest tags that already exist in staged storage.
This makes it hard for users to see how widely a suggested tag has already been
associated with parent items, even though staged records already carry
`parentBindings`.

## What Changes
- Keep staged-hit suggest tags visible in the `tag-regulator` suggest dialog.
- Merge the current parent item into staged `parentBindings` before the dialog opens.
- Show parent-binding counts in both the `tag-regulator` suggest dialog and the
  `tag-manager` staged inbox.
- Add an explicit header row to the `tag-regulator` suggest dialog.

## Impact
- Users can see the current parent-binding count before deciding whether to join
  a suggested tag into controlled vocabulary.
- Existing staged semantics remain unchanged: staged tags are still pending and
  do not mutate parent item tags until committed success.
