## Context

Reference notes produced by `literature-digest` intentionally persist structured data in hidden payload blocks and expose a rendered table for readability. This is good for machine-readability, but currently lacks a first-class payload editing path in Zotero UI.

The new workflow must preserve the existing payload contract while introducing safe editing.

## Goals / Non-Goals

**Goals:**

- Provide a dedicated payload editor workflow for references notes.
- Keep note format compatible with current `literature-digest` and `reference-matching` contracts.
- Support multi-input triggers with deterministic, one-window-at-a-time UX.
- Make cancel/close semantics explicit and deterministic (job failure).

**Non-Goals:**

- No backend/provider network calls.
- No schema migration for references payload.
- No autosave/draft persistence.

## Decisions

### Decision 1: Provider model = pass-through

- The workflow uses `provider = "pass-through"` and local hooks only.
- The request/result channel carries selection context and editor outcome.

### Decision 2: Input legality mirrors reference-matching

- Accept references notes directly selected.
- Accept parents that can resolve to references notes after expansion.
- If no valid references note exists after filtering, workflow is not executable.

### Decision 3: Editor interaction and failure semantics

- Open a modal editor window per valid input unit.
- Editor shows current parent title/item identifier prominently.
- User can edit rows, add rows, delete rows, reorder rows.
- On Save:
  - validate form data,
  - regenerate canonical payload JSON,
  - regenerate canonical references table,
  - overwrite note generated section.
- On Cancel/Close:
  - do not modify note,
  - current job fails with explicit cancel reason.

### Decision 4: Multi-input sequencing

- If one trigger produces multiple valid inputs, modal windows are shown sequentially in deterministic order (input order after filtering).
- Each modal clearly indicates current item context to avoid cross-item confusion.

### Decision 5: Canonical rewrite contract

- Reuse existing payload encoding strategy (`data-zs-payload="references-json"` with encoded JSON payload).
- Reuse canonical table structure (`data-zs-view="references-table"`).
- Ensure payload and rendered table remain synchronized after each save.

## Risks / Trade-offs

- Manual editing may introduce invalid rows.
  - Mitigation: client-side validation before Save.
- Multi-window editing may feel slow for large batches.
  - Mitigation: explicit progress/context indicators per modal.
- Divergence risk if rewrite logic forks from existing references table/payload generation.
  - Mitigation: centralize rendering/encoding helpers and reuse shared logic where possible.

## Migration Plan

1. Add workflow manifest and hooks.
2. Implement modal editor UI module.
3. Implement save/cancel flow integration.
4. Add tests for:
  - input legality and filtering,
  - add/delete/reorder persistence,
  - sequential multi-input windows,
  - cancel -> failed job semantics,
  - payload/table synchronization.
