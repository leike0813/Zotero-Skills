# Design

## Summary

This change prunes routine Zotero coverage in two layers:

1. a global file-level allowlist skips non-retained files in real Zotero runs
2. mixed retained files keep only 1-2 canonical smoke cases in Zotero and push
   the rest to `node-only`

Node execution remains unchanged.

## File-Level Pruning

`test/00-domain-filter.test.ts` already enforces domain-level skipping. Extend
that same hook with a Zotero routine allowlist:

- active only in real Zotero runtime
- inactive in Node mock runtime
- keyed by first-level domain (`core`, `ui`, `workflow`)
- returns early for non-domain helper/setup files

This keeps command surface unchanged while narrowing the routine Zotero suite.

## Mixed-File Smoke Reduction

Some retained files still contain many non-smoke cases. Those files will define
`itNodeOnly = isZoteroRuntime() ? it.skip : it` and move non-smoke cases behind
that gate.

Retained Zotero smoke cases:

- `workflow-literature-digest/21`: request build from markdown + bundle apply
- `workflow-literature-explainer/21`: markdown request build + bundle-relative
  note creation
- `workflow-literature-workbench-package/45`: canonical export path + single
  parent import validation
- `workflow-reference-matching/24`: parent-selection routing + end-to-end
  overwrite success
- `workflow-mineru/39`: canonical request build + result materialization
- `workflow-tag-regulator/64a`: manifest load + request building
- `ui/35`: persisted execution context + local pass-through resolution
- `ui/50`: provider visibility + effort-choice smoke

## Documentation

Governance docs must explicitly record the retained routine Zotero inventory so
future additions do not silently expand the suite again.
