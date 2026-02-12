## Why

`literature-digest` writes reference data in a hidden JSON payload (`references-json`) and renders a visible HTML table in Zotero notes. Users can edit the table visually, but those edits do not update the payload body, causing payload/render divergence and downstream workflow inconsistency.

To make references truly editable, the project needs a dedicated workflow that edits the payload body directly and rewrites the note in the same canonical structure.

## What Changes

- Add a new workflow to edit literature-digest reference notes through a dedicated editor window.
- Use `pass-through` provider only (local execution, no remote backend dependency).
- Accept the same legal inputs as reference-matching:
  - directly selected references note,
  - parent selection expanded to references note(s).
- Show editable references as a form-style UI that supports:
  - field updates,
  - adding/removing entries,
  - reordering entries.
- Save action rewrites payload + rendered table together (full overwrite of generated region).
- Close/cancel without save marks the current job as failed.
- For multiple valid inputs in one trigger, show windows sequentially and display which parent item each window belongs to.

## Capabilities

### New Capabilities

- `reference-note-editor-workflow`: edit `references-json` payload body with structured form UI and canonical note rewrite.

### Modified Capabilities

- None.

## Impact

- New workflow package under `workflows/reference-note-editor/`.
- New editor UI module(s) in `src/modules/` for modal editing flow.
- Runtime-facing tests for multi-input sequencing, save/cancel semantics, and payload-table consistency.
