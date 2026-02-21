## Context

The current workflow runtime emits execution reminders (start toast, per-job toast, final summary alert), and workflow editor host treats non-save close as cancellation/failure. This fits task-style workflows but is mismatched for editor-style workflows where the primary user intent is editing and deciding whether to save.

`tag-manager` is additionally selection-agnostic: it opens the same vocabulary editor regardless of selected item, but currently still appends selected parent title in the editor window title.

## Goals / Non-Goals

**Goals:**
- Add a declarative workflow-level switch to suppress workflow execution reminders (start toast, per-job toast, final summary alert) for editor-style workflows.
- Keep default runtime behavior unchanged for workflows that do not opt in.
- Add dirty-aware close behavior in workflow editor host:
  - clean close: close directly
  - dirty close: ask save/discard/cancel
  - choose save: persist through existing save path and close
  - choose discard: close without persistence
  - choose cancel: keep editor open
- Apply the new behavior to `tag-manager` and `reference-note-editor`.
- Remove selection-derived suffix from `tag-manager` editor title.

**Non-Goals:**
- No redesign of editor renderer layout or field-level validation rules.
- No change to workflow execution pipeline ordering or provider protocol.
- No change to workflow runtime logging semantics.

## Decisions

### 1. Manifest switch lives under `execution.feedback`

Decision:
- Extend workflow manifest schema with `execution.feedback.showNotifications?: boolean` (default `true` when omitted).

Rationale:
- Keeps feedback policy attached to execution semantics instead of hook code.
- Provides forward-compatible namespace (`execution.feedback`) for future workflow feedback controls.
- Preserves backward compatibility by defaulting to current behavior.

Alternatives considered:
- Top-level `ui` flag: rejected because summary alert is runtime execution feedback, not renderer-only UI.
- Hook-returned runtime override: rejected due to implicit behavior and harder manifest discoverability.

### 2. Runtime suppression checks all workflow reminder paths

Decision:
- Gate workflow reminder emitters (`emitWorkflowStartToast`, `emitWorkflowJobToasts`, `emitWorkflowFinishSummary`) with `showNotifications`.
- Keep runtime logging behavior unchanged.

Rationale:
- Matches explicit user requirement (“no workflow reminders for editor workflows”).
- Minimizes risk by isolating suppression to UI reminder channels.

Alternatives considered:
- Add a separate toast-specific switch: rejected to avoid redundant config and UX complexity.

### 3. Dirty-state close confirmation implemented in workflow editor host

Decision:
- Add host-level dirty detection by comparing serialized current editor state against initial state snapshot.
- On non-save close:
  - if clean: return `{ saved: false, reason: "canceled" }` without prompt
  - if dirty: show save/discard/cancel confirm
    - save => return `{ saved: true, result }`
    - discard => return `{ saved: false, reason: "discarded" }`
    - cancel => keep dialog open and continue current session

Rationale:
- Centralizes behavior for all host-based editors.
- Avoids renderer-specific duplicated dirty logic.
- Works for both patchState-based and direct mutable-state renderers by evaluating at close time.

Alternatives considered:
- Renderer-managed dirty flag API: rejected for higher migration burden and weaker consistency guarantees.

### 4. `tag-manager` title is workflow-centric, not selection-centric

Decision:
- Use manifest label only for tag-manager editor dialog title.

Rationale:
- Tag manager behavior does not depend on selected item input.
- Prevents misleading contextual title text.

## Risks / Trade-offs

- [Dirty comparison false positives due to ordering/noise] → Use stable serialization path already used by renderer `serialize` output; compare normalized payload shape where possible.
- [Prompt API differences across runtimes] → Implement `Zotero.Prompt` first, fallback to `window.confirm`; default behavior remains safe keep-editing branch if prompt unavailable.
- [Spec/runtime drift for new execution.feedback field] → Update manifest schema, TypeScript manifest types, and runtime usage in one change with tests.
- [Behavior confusion between canceled vs discarded reasons] → Keep explicit reason strings and test both host and workflow integration paths.

## Migration Plan

1. Add schema/type support for `execution.feedback.showNotifications`.
2. Add runtime guard for workflow reminder emission.
3. Implement workflow editor host dirty-close confirmation flow.
4. Opt in `tag-manager` and `reference-note-editor` manifests.
5. Remove selection-title suffix from `tag-manager` apply hook.
6. Update/add tests for schema parsing, runtime alert gating, editor close behavior, and workflow-level integration.

Rollback:
- Remove manifest opt-in fields and revert runtime/editor-host guard paths; default behavior is preserved by existing code paths.

## Open Questions

- None.
