## Context

Workflow settings currently spans multiple responsibilities across `workflowSettings.ts` and `workflowSettingsDialog.ts`.  
This increases coupling between domain rules and UI updates, and makes seam-level testing harder than necessary.

## Goals / Non-Goals

**Goals**

- Define explicit settings-domain contracts independent of dialog rendering.
- Keep run-once and persistent semantics stable.
- Keep execution-context merge behavior stable and testable.
- Reduce duplication and cross-module hidden assumptions.

**Non-Goals**

- Redesigning workflow settings UI.
- Introducing new setting fields or changing persistence schema.
- Changing backend/provider resolution rules.

## Decisions

### Decision 1: Introduce a Settings Domain Module

Create a dedicated domain module (or equivalent seam layer) owning:

- persisted record load/save normalization,
- run-once snapshot initialization from persisted state,
- merged execution settings resolution.

Dialog code consumes this module and no longer re-implements domain rules.

### Decision 2: Make Domain Flow Explicit and Typed

Define explicit input/output contracts for:

- `loadPersistedSettings(workflowId)`
- `buildDialogInitialState(workflowId)`
- `applyPersistentSave(workflowId, draft)`
- `applyRunOnce(workflowId, draft)`
- `buildExecutionSettings(workflowId)`

All conversion/normalization happens inside domain APIs.

### Decision 3: Centralize Validation and Fallback Semantics

Keep workflow/provider-specific normalization inside one validation pipeline in the domain layer, including existing fallback behavior.

### Decision 4: Behavior Parity Gate

No user-visible drift for:

- open/save/run-once interactions,
- run-once default reset-on-open behavior,
- workflow execution context produced from settings.

## Risks / Trade-offs

- [Risk] Refactor may subtly alter run-once precedence behavior.  
  Mitigation: add focused regression tests for open/save/run-once merge sequence.

- [Risk] Splitting modules can duplicate type definitions.  
  Mitigation: define shared domain contract types and reuse in dialog/runtime.

## Migration Plan

1. Extract settings-domain contracts and helper functions from existing module.
2. Redirect dialog module to domain APIs while preserving UI behavior.
3. Add domain-level regression tests and retain existing integration tests.
4. Verify node/zotero impacted suites for parity.

## Acceptance Gates (Inherited)

- Behavior parity
- Test parity
- Readability delta
- Traceability to `HB-04`
