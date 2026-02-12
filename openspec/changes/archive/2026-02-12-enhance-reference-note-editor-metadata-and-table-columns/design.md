## Context

Reference Note currently has two coupled surfaces:
- hidden canonical payload (`references-json`),
- visible HTML references table (`data-zs-view="references-table"`).

After the recent `literature-digest` skill upgrade, optional bibliographic fields are now produced with better stability (`publicationTitle`, `conferenceName`, `university`, `archiveID`, `volume`, `issue`, `pages`, `place`). However:
- the Reference Note Editor does not expose these fields,
- shared table rendering in `literature-digest`, `reference-matching`, and `reference-note-editor` does not display them.

This creates an editing/visibility gap and increases risk of behavior divergence because each workflow currently carries its own references-table rendering path.

## Goals / Non-Goals

**Goals:**
- Extend Reference Note Editor to support editing the newly stabilized optional metadata fields.
- Keep editor UX compact and usable for large reference lists.
- Add two canonical table columns:
  - `Source` (single chosen source field),
  - `Locator` (merged publication/thesis locating data).
- Keep payload contract unchanged while ensuring payload/table stay synchronized.
- Align all three workflows (`literature-digest`, `reference-matching`, `reference-note-editor`) to one shared rendering rule set.

**Non-Goals:**
- No payload schema migration or breaking field rename.
- No backend/protocol/provider behavior change.
- No introduction of draft autosave or partial save semantics in editor.

## Decisions

### Decision 1: Keep payload schema backward compatible, add optional fields as pass-through

`references-json` remains the source of truth and keeps existing required behavior (`title`, `author`, `year`, `citekey`, `rawText` when present). Newly supported metadata fields are treated as optional passthrough fields in payload rows.

Rationale:
- avoids migration complexity for existing notes,
- preserves compatibility with existing matching logic and downstream consumers.

Alternative considered:
- define a strict new schema version for references payload.
  - Rejected for this change due to migration/compatibility overhead.

### Decision 2: Extend editor with compact secondary metadata section per row

Each row remains title-first, and new fields are rendered in a compact secondary section:
- source candidates: `publicationTitle`, `conferenceName`, `university`, `archiveID`,
- locator parts: `volume`, `issue`, `pages`, `place`.

Layout policy:
- keep `Title` dominant width,
- keep short fields (`year`, `citekey`, `volume`, `issue`) narrow,
- keep row action icons (up/down/delete) inline on right,
- keep `rawText` visible/editable.

Rationale:
- supports richer metadata without making row cards visually bloated.

Alternative considered:
- move metadata editing to a separate advanced dialog.
  - Rejected because it increases editing friction and breaks one-pass row editing.

### Decision 3: Canonical `Source` column uses deterministic precedence

For each reference row, `Source` chooses the first non-empty value in this order:
1. `publicationTitle`
2. `conferenceName`
3. `university`
4. `archiveID`

Assumption: these fields are logically near-mutually-exclusive for one record; precedence handles edge cases deterministically.

Rationale:
- stable single-value rendering for table scanning,
- predictable behavior when multiple fields are accidentally present.

Alternative considered:
- concatenate all non-empty source fields.
  - Rejected because it increases noise and breaks compact table readability.

### Decision 4: Canonical `Locator` column merges edition/location fragments

`Locator` is rendered from non-empty subset of:
- `volume`
- `issue`
- `pages`
- `place`

Rendering is deterministic and compact (join non-empty parts in fixed order). If all are empty, render empty cell.

Rationale:
- preserves useful bibliographic locating info in one concise column,
- supports both journal-style and thesis-style records.

Alternative considered:
- separate columns for `volume`/`issue`/`pages`/`place`.
  - Rejected because it expands table width significantly and hurts Zotero note readability.

### Decision 5: Unify reference-table rewrite rule as shared helper

The three workflows that rewrite references notes must consume one shared canonical table-rendering/encoding helper (single rule set, no per-workflow drift).

Scope of shared helper:
- row normalization,
- `Source`/`Locator` rendering rules,
- table header/column order,
- payload+table synchronized overwrite behavior.

Rationale:
- prevents future divergence bugs across workflows,
- reduces duplicate maintenance.

Alternative considered:
- patch each workflow separately.
  - Rejected due to high drift risk.

## Risks / Trade-offs

- [Risk] Column changes may break snapshot-based tests and fixture expectations.  
  → Mitigation: update fixtures and add explicit canonical rendering tests for `Source`/`Locator`.

- [Risk] Compact editor layout may still feel dense on small screens.  
  → Mitigation: keep responsive row wrapping and preserve obvious scroll container behavior.

- [Risk] Existing notes with sparse metadata may show many empty cells.  
  → Mitigation: keep blank-cell behavior explicit; no fake placeholder text in persisted note table.

- [Risk] Shared helper refactor could regress one workflow’s rewrite path.  
  → Mitigation: add workflow-level regression tests for all three workflows on same payload fixtures.

## Migration Plan

1. Add/extend specs for:
   - editor metadata fields,
   - canonical `Source`/`Locator` table rendering.
2. Introduce shared canonical rendering helper and integrate into:
   - `literature-digest`,
   - `reference-matching`,
   - `reference-note-editor`.
3. Extend Reference Note Editor UI bindings/state mapping for new fields.
4. Update and add tests:
   - editor field round-trip save,
   - cross-workflow canonical table parity,
   - payload/table synchronization.
5. Run build + node full tests; then validate via Zotero smoke tests.

## Open Questions

- None currently.
