## Context

Workflow authoring now relies on multiple contracts spread across:

- type/runtime definitions (`src/workflows/types.ts`, `src/workflows/helpers.ts`, `src/workflows/loader.ts`);
- workflow protocol docs (`doc/components/workflows.md`);
- hook helper docs (`doc/components/workflow-hook-helpers.md`);
- dialog/editor host bridge behavior (`src/modules/workflowEditorHost.ts` and workflow-side usage).

The docs are currently incomplete and partially inconsistent with implementation.

## Goals / Non-Goals

**Goals**

- Make workflow protocol docs match current implementation contract.
- Publish a complete helper API reference for `runtime.helpers`.
- Explicitly document hook-facing dialog/editor APIs and constraints.
- Define a lightweight documentation maintenance rule to prevent future drift.

**Non-Goals**

- No code refactor in workflow runtime/helpers.
- No behavior change to hooks, dialogs, or workflow execution.
- No new helper APIs in this change.

## Decisions

### Decision 1: Use implementation as source of truth

Documentation SHALL be aligned from concrete runtime/type files:

- `src/workflows/types.ts`
- `src/workflows/helpers.ts`
- `src/workflows/loader.ts`
- `src/modules/workflowEditorHost.ts`

No inferred/legacy wording without code evidence.

### Decision 2: Split documentation into two scopes

- `workflows.md`: protocol-level contract (manifest/hook lifecycle/request kinds/failure semantics/canonical rendering rules).
- `workflow-hook-helpers.md`: API-level reference (function signature, input expectations, return value, edge/error semantics, examples).

### Decision 3: Document dialog APIs as hook-facing bridge section

Dialog/editor functions are not part of `runtime.helpers`, but hooks may rely on bridge entrypoints (especially editor workflows).
The docs SHALL include:

- bridge identity and ownership;
- callable functions and expected payload shape;
- sequencing semantics for multi-input jobs;
- cancel/failure behavior contract.

### Decision 4: Add drift-prevention checklist

Documentation SHALL include a short “when to update this doc” checklist tied to helper/hook contract changes.

## Risks / Trade-offs

- [Risk] Over-documenting internals can increase maintenance burden  
  Mitigation: keep API docs focused on stable hook-facing surface, avoid private UI internals.

- [Risk] Future helper additions may bypass docs again  
  Mitigation: add explicit update checklist and traceability note in docs.

