# Design

## Core approach

Implement the harness in `test/zotero/objectCleanupHarness.ts`, not in `src/`,
so production code is unaffected. The harness installs once and wraps selected
`handlers` creation/removal methods.

Tracked creation entry points:

- `handlers.item.create`
- `handlers.parent.addNote`
- `handlers.parent.addAttachment`
- `handlers.note.create`
- `handlers.attachment.create`
- `handlers.attachment.createFromPath`
- `handlers.collection.create`

Tracked removal entry points:

- `handlers.item.remove`
- `handlers.note.remove`
- `handlers.attachment.remove`
- `handlers.collection.delete`

## Tracking model

- keep two sets: tracked item ids and tracked collection ids
- only track newly created objects
- object mutation helpers such as tag/field updates do not affect tracking
- direct-object tests may call `registerZoteroTestObjectForCleanup(...)`

## Cleanup order

On teardown, classify tracked items from the live Zotero DB and delete in this
order:

1. child notes
2. attachments
3. other child items
4. top-level parent items
5. collections

Deletion is best-effort. Failures log a runtime warning and do not fail the
teardown path.

## Shared teardown integration

Shared Zotero teardown order becomes:

1. emit failure diagnostics
2. run background runtime cleanup
3. run tracked real-object cleanup

This ordering prevents background loops from touching objects while they are
being deleted.

## Debug escape hatch

The harness respects `ZOTERO_KEEP_TEST_OBJECTS`. When enabled, it still tracks
objects during the test but skips deletion during teardown so the local DB state
can be inspected manually.
