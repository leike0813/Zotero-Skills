## Context

Reference notes are written through a shared canonical renderer in `src/workflows/helpers.ts`.
This renderer already computes `Source` and `Locator`, but current header order is:

- `#`, `Citekey`, `Year`, `Title`, `Source`, `Locator`, `Authors`

Obsidian templates currently do not expose `Source`/`Locator` in either field or note view.

## Goals / Non-Goals

**Goals**

- Move `Source` and `Locator` after `Authors` in canonical reference table output.
- Keep existing source/locator mapping semantics unchanged.
- Make Obsidian templates render `Source` and `Locator` in the same order as Zotero.

**Non-Goals**

- No changes to payload schema.
- No changes to source precedence or locator composition wording.
- No workflow behavior changes beyond presentation order/projection.

## Decisions

### Decision 1: Canonical table order update

Update shared renderer header and row order to:

1. `#`
2. `Citekey`
3. `Year`
4. `Title`
5. `Authors`
6. `Source`
7. `Locator`

### Decision 2: Mapping rules remain canonical and unchanged

- `Source`: first non-empty of `publicationTitle`, `conferenceName`, `university`, `archiveID`
- `Locator`: deterministic composition from `volume`, `issue`, `pages`, `place`

### Decision 3: Obsidian templates mirror canonical renderer

For both `zt-note.eta` and `zt-field.eta`:

- add local helper logic for `Source` and `Locator`,
- output rows in canonical order (`Authors` before `Source`/`Locator`).

## Risks / Trade-offs

- Existing tests/snapshots that assert old header order will fail.
  - Mitigation: update affected tests to assert new canonical order.
- Obsidian user templates may rely on prior column sequence.
  - Mitigation: confine changes to official shipped templates and document via change artifacts.

## Validation

- Type check passes: `npx tsc --noEmit`
- Full node test suite passes: `npm run test:node:full`
- Header and row assertions in reference-matching and reference-note-editor tests reflect new order.
