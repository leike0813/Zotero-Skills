## Context

`workflowSettingsDialog.ts` is currently the UI boundary for workflow settings but still carries heavy model assembly logic.
This causes a mixed responsibility surface and makes dialog-level changes expensive to review.

`HB-04` already established settings domain contracts; `HB-05` now completes Boundary D by splitting dialog render model concerns from UI host concerns.

## Goals / Non-Goals

**Goals**

- Introduce an explicit, typed render-model layer for workflow settings dialog.
- Ensure dialog rendering consumes model descriptors instead of constructing schema logic inline.
- Keep save/apply payload shaping centralized and testable.
- Preserve behavior parity and localization behavior.

**Non-Goals**

- Redesigning dialog UX layout or adding new settings features.
- Changing persistence schema or execution precedence rules.
- Altering workflow-specific normalization semantics.

## Decisions

### Decision 1: Extract dialog render-model builders as pure functions

Create dialog-model functions that take:

- workflow manifest parameter schemas,
- persisted/run-once initial state (from settings domain),
- localized label resolver (or pre-localized strings),

and output deterministic view model descriptors for rendering.

### Decision 2: Keep dialog host focused on lifecycle and rendering

`workflowSettingsDialog.ts` will own:

- window/dialog lifecycle,
- rendering widgets from model descriptors,
- wiring button actions and user events.

It will no longer own schema merge/default rules.

### Decision 3: Centralize draft collection and serialization

Add a model-aware draft collector/serializer so save/apply payloads are shaped in one place, then passed to settings domain APIs.

### Decision 4: Behavior parity gate is mandatory

No user-visible drift allowed for:

- run-once defaults reset per open,
- persistent save and run-once apply semantics,
- success/error messaging flow.

## Risks / Trade-offs

- [Risk] Refactor may subtly break field binding or draft collection.
  Mitigation: add focused tests for model composition and draft serialization paths.

- [Risk] Additional modules may increase indirection.
  Mitigation: keep contracts small and colocate model module near dialog host.

## Migration Plan

1. Define dialog render-model contracts and pure builders.
2. Refactor dialog host to render from model descriptors.
3. Extract/centralize draft collection to typed serializer.
4. Add regression tests and parity checks for dialog behavior.

## Acceptance Gates (Inherited)

- Behavior parity
- Test parity
- Readability delta
- Traceability to `HB-05`
