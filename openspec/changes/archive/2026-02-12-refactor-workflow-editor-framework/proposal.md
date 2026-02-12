## Why

The current `reference-note-editor` can functionally edit payloads, but its UI is hard to use at scale and its implementation is coupled to plugin core code. We need a reusable workflow editor framework so future workflow authors can build local editors with lower effort and cleaner architecture.

## What Changes

- Add a generic workflow editor host in plugin core that manages dialog lifecycle, sequential opening, save/cancel contract, and renderer dispatch.
- Define an extensible renderer interface so workflows can provide their own editor renderer without adding workflow-specific UI logic into core modules.
- Refactor `reference-note-editor` to use the new host + renderer interface and remove workflow-specific editor implementation from core module code.
- Redesign reference editor layout for compact editing:
  - larger default window size and explicit minimum usable size,
  - visible and stable scroll area for long reference lists,
  - compact row layout with left row index, right-side icon controls,
  - remove editable ID exposure from primary form,
  - keep `Raw Text` always visible and editable,
  - rebalance field widths (`Title` large, `Year/Citekey` compact).
- Preserve existing save semantics (overwrite payload + rendered table) and cancel semantics (job fails with no write).

## Capabilities

### New Capabilities
- `workflow-editor-host`: Generic local editor host and renderer dispatch contract for workflow-driven dialogs.
- `reference-note-editor-ui`: Reference payload renderer implementation on top of host, including compact layout and usability constraints.

### Modified Capabilities
- `reference-note-editor-workflow`: Switch execution path from core-coupled editor module to host+renderer architecture while preserving save/cancel behavior contract.

## Impact

- Affected code:
  - `src/modules/` (new generic editor host module, removal/refactor of workflow-specific editor module),
  - `src/hooks.ts` (host registration),
  - `workflows/reference-note-editor/hooks/*` (renderer registration / invocation contract updates),
  - related tests and workflow docs.
- No backend/API dependency changes.
- Potential light i18n additions for shared host labels and renderer-provided labels.

