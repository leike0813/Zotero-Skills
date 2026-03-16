## Why

Main-window toolbar currently only exposes a Dashboard shortcut.  
Users need a fast execution entry that mirrors workflow trigger behavior from the item context menu, without mixing utility actions.

We also need stable placement rules:

- `Execute Workflow` aligned with the left functional toolbar group (right after `zotero-tb-note-add`)
- `Dashboard` remains on the right side before search

## What Changes

- Add a new toolbar icon menu button: `Execute Workflow`.
- Reuse the same workflow trigger eligibility/label logic from workflow context menu.
- Exclude non-workflow utility entries (`Open Dashboard...`) from the toolbar execution menu.
- Keep existing Dashboard toolbar button behavior and placement unchanged.

## Capabilities

### Updated Capabilities
- `task-runtime-ui`

## Impact

- Affects toolbar button injection/removal in main-window lifecycle.
- Affects workflow menu composition by introducing shared popup-builder logic.
- Adds locale key for execute-workflow toolbar tooltip.
- Updates toolbar/menu tests.
