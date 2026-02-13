## Why

Reference Note table rendering currently places `Source` and `Locator` before `Authors`.
For readability and consistency with downstream reading flow, these columns should come after `Authors`.

At the same time, Obsidian-side ETA templates (`zt-note.eta`, `zt-field.eta`) do not yet project
`Source` and `Locator`, causing a cross-surface mismatch between Zotero note rendering and Obsidian card rendering.

## What Changes

- Reorder canonical references table columns in shared renderer to:
  - `#`, `Citekey`, `Year`, `Title`, `Authors`, `Source`, `Locator`
- Keep `Source` precedence and `Locator` composition rules unchanged.
- Enhance literature-digest Obsidian templates:
  - `workflows/literature-digest/assets/zt-note.eta`
  - `workflows/literature-digest/assets/zt-field.eta`
  so they render `Source` and `Locator` using the same canonical mapping logic and column order.
- Update relevant tests to assert the new canonical order.

## Capabilities

### Modified Capabilities

- `reference-note-source-locator-rendering`
- `literature-digest-note-source-link`

## Impact

- Affects shared references table renderer used by:
  - `literature-digest`
  - `reference-matching`
  - `reference-note-editor`
- Affects Obsidian output templates in `workflows/literature-digest/assets/`.
- User-visible change:
  - Reference columns order changes in Zotero and Obsidian outputs.
