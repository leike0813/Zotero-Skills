## Context

`reference-note-editor` is currently implemented via a workflow-specific dialog module in plugin core (`src/modules/referenceNoteEditor.ts`) and invoked through a global bridge. This solves immediate editing needs but violates the plugin’s pluggable workflow direction:

- Workflow-specific UI logic is embedded in core.
- Reusing this path for other workflows requires adding more core coupling.
- Current layout has usability issues for large datasets (window size, scroll discoverability, whitespace, dense controls, raw text visibility).

The project already relies on `pass-through` for local workflow execution and supports hook-driven workflow behavior. This provides a natural place to move workflow-specific editor behavior while retaining a generic host in core.

## Goals / Non-Goals

**Goals:**
- Introduce a generic workflow editor host in core.
- Define a renderer interface that workflows can plug into without adding new core business logic.
- Refactor `reference-note-editor` to consume this host as the first renderer.
- Fix current reference editor usability issues:
  - reasonable default and minimum window dimensions,
  - clear scroll container behavior for long lists,
  - compact row layout and improved field proportion,
  - `Raw Text` always visible/editable,
  - no primary editable `ID` field.
- Preserve save/cancel semantics and sequential multi-item workflow behavior.

**Non-Goals:**
- No backend/provider transport changes.
- No reference payload schema migration.
- No generic visual schema builder for all arbitrary UI controls in this change.

## Decisions

### Decision 1: Core provides host, workflow provides renderer

Create `workflowEditorHost` in core to handle:
- dialog creation/destruction,
- sequential session handling,
- save/cancel resolution contract,
- host-level window sizing and scroll container policy,
- renderer loading/dispatch by renderer id.

Workflow-specific rendering (reference row layout, field bindings, row actions) is moved to workflow-side renderer module(s), loaded by hook-side resolver.

Rationale:
- keeps core reusable and lean,
- reduces burden for future workflow authors to only provide renderer + adapter logic,
- avoids repeating dialog plumbing in each workflow.

Alternative considered:
- keep current core-coupled editor and only tweak UI.
  - Rejected: short-term fix, long-term architectural debt.

### Decision 2: Renderer contract is explicit and minimal

Define a renderer contract similar to:
- `render(container, context, state, hostApi)`
- renderer returns state mutations via hostApi callbacks.

Host remains owner of save/cancel final payload and lifecycle; renderer owns layout and field interaction.

Rationale:
- prevents renderer from handling window lifecycle directly,
- keeps testability and deterministic workflow outcome.

Alternative considered:
- full renderer self-managed dialog lifecycle.
  - Rejected: hard to guarantee uniform save/cancel semantics and sequencing.

### Decision 3: Reference renderer adopts compact “row strip” layout

For each reference entry:
- left narrow index column,
- central editable content area with proportional fields (`Title` dominant, `Year/Citekey` compact),
- right inline icon button column (up/down/delete),
- `Raw Text` always shown in row body.

Additional UI policies:
- hide editable `ID` from default view,
- fixed sensible initial size + minimum size,
- main list area is obvious vertical scroll region.

Rationale:
- improves density and discoverability for multi-row editing,
- aligns with user workflow (frequent row operations, frequent title/citekey edits).

### Decision 4: Backward compatibility via adapter layer

`reference-note-editor` hook `applyResult` keeps current input/output contract and only swaps editor invocation target:
- old bridge call is replaced by host+renderer API.
- payload/table rewrite logic remains unchanged except normalization updates needed by new UI state.

Rationale:
- minimizes behavior regression risk,
- keeps existing tests and user workflow semantics stable.

## Risks / Trade-offs

- [Risk] Host/renderer boundary too abstract for first implementation.
  - Mitigation: start with one concrete renderer (reference editor) and one stable contract; avoid over-generalization.
- [Risk] Dynamic renderer loading from workflow files can fail silently in runtime differences.
  - Mitigation: explicit load errors surfaced as workflow failure reasons; add focused tests.
- [Risk] UI regression on small screens/high-DPI environments.
  - Mitigation: define min/max sizes and scroll behavior requirements in specs + GUI tests.
- [Risk] Existing tests coupled to old bridge variable.
  - Mitigation: keep compatibility shim for one migration cycle, then remove after tests updated.

## Migration Plan

1. Introduce host module and renderer contract in core.
2. Add reference renderer implementation under workflow package and connect apply hook to host API.
3. Keep temporary compatibility shim for one cycle; migrate tests to new API.
4. Remove old workflow-specific core module (`referenceNoteEditor.ts`) business logic.
5. Validate with focused node tests + build + manual Zotero smoke checks for large reference lists.

## Open Questions

- Should icon resources for row actions come from existing addon icon assets or be pure text-symbol fallback in this change?
- Should host expose optional renderer-level i18n helper now, or defer to next i18n-focused change?

