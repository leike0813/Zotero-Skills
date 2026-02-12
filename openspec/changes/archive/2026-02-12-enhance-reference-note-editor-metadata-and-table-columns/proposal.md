## Why

`literature-digest` now outputs additional bibliographic metadata fields more reliably, but the current Reference Note Editor and rendered references table do not expose these fields. This creates a usability and consistency gap: users cannot edit newly available metadata in the editor, and shared note rendering cannot present key source/locator information.

## What Changes

- Extend Reference Note Editor form fields to support optional metadata:
  - `publicationTitle`
  - `conferenceName`
  - `university`
  - `archiveID`
  - `volume`
  - `issue`
  - `pages`
  - `place`
- Keep the editor compact by giving these new fields smaller, secondary-weight input areas.
- Upgrade shared Reference Note HTML table rendering (used by `literature-digest`, `reference-matching`, and `reference-note-editor`) with:
  - a new `Source` column:
    - render one value from `publicationTitle | conferenceName | university | archiveID` (first non-empty, mutually exclusive expectation),
  - a new `Locator` column:
    - merged rendering from `volume`, `issue`, `pages`, and thesis-related `place`.
- Preserve existing payload contract (`references-json`) and canonical overwrite behavior.

## Capabilities

### New Capabilities

- `reference-note-extended-metadata-editing`: Reference Note Editor can view/edit the newly stabilized optional bibliographic metadata fields with compact UI layout.
- `reference-note-source-locator-rendering`: Canonical references table rendering includes `Source` and `Locator` columns based on normalized metadata mapping rules.

### Modified Capabilities

- None.

## Impact

- Affected workflows:
  - `workflows/reference-note-editor/` (editor UI + save rewrite path)
  - `workflows/literature-digest/` (reference note render output)
  - `workflows/reference-matching/` (reference note overwrite/render sync output)
- Shared rendering path for references table should be updated or centralized to avoid divergence across workflows.
- Tests need updates/additions for:
  - editor field visibility/edit/save coverage for new metadata,
  - canonical `Source`/`Locator` rendering,
  - payload-table synchronization after overwrite in all three workflows.
