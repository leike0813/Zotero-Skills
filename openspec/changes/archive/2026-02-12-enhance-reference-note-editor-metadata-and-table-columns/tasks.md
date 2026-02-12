## 1. Shared Canonical Rendering

- [x] 1.1 Extract or create shared references-table rendering helper used by literature-digest, reference-matching, and reference-note-editor
- [x] 1.2 Implement canonical `Source` mapping with precedence: `publicationTitle > conferenceName > university > archiveID`
- [x] 1.3 Implement canonical `Locator` mapping from `volume`, `issue`, `pages`, and `place` with deterministic ordering
- [x] 1.4 Update shared table header to include `Source` and `Locator` columns and keep payload/table sync contract unchanged

## 2. Reference Note Editor Metadata UX

- [x] 2.1 Extend reference row model/state to include `publicationTitle`, `conferenceName`, `university`, `archiveID`, `volume`, `issue`, `pages`, and `place`
- [x] 2.2 Add compact editor inputs for new metadata fields while preserving existing row operations (add/delete/reorder)
- [x] 2.3 Ensure save path writes extended metadata fields back into `references-json` payload rows without dropping existing fields
- [x] 2.4 Keep `rawText` visibility/editability and maintain current cancel-without-save failure behavior

## 3. Workflow Integration

- [x] 3.1 Integrate shared rendering helper into `workflows/literature-digest/hooks/applyResult.js`
- [x] 3.2 Integrate shared rendering helper into `workflows/reference-matching/hooks/applyResult.js`
- [x] 3.3 Integrate shared rendering helper into `workflows/reference-note-editor/hooks/applyResult.js`
- [x] 3.4 Verify identical `Source`/`Locator` rendering output across the three workflows for equivalent payload input

## 4. Tests and Validation (TDD)

- [x] 4.1 Add/adjust editor tests for extended metadata field display, edit, and save round-trip
- [x] 4.2 Add/adjust rendering tests for `Source` precedence and `Locator` merge behavior
- [x] 4.3 Add/adjust cross-workflow parity tests to ensure canonical table output consistency
- [x] 4.4 Run `npm run build`, `npm run test:node:full`, and required focused Zotero tests

## 5. Documentation

- [x] 5.1 Update workflow/component docs for extended reference metadata fields and new table columns
- [x] 5.2 Document `Source` and `Locator` mapping rules for downstream consumers and template authors
