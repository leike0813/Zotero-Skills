## Why

Current workflow documentation has drifted from implementation in two high-impact areas:

- workflow protocol details in `doc/components/workflows.md` are partially outdated (e.g. hook set and canonical reference table order);
- `doc/components/workflow-hook-helpers.md` does not enumerate the full `runtime.helpers` surface and lacks precise API-level behavior notes.

This increases onboarding cost and causes avoidable integration mistakes when developing workflow hooks.

## What Changes

- Align workflow protocol docs with current runtime contract and loader/types implementation.
- Expand hook helper docs into a complete API reference for all currently supported `runtime.helpers`.
- Document hook-facing dialog/editor bridge functions and usage boundaries (where they live, how hooks call them, lifecycle/error semantics).
- Add maintenance guidance so future helper additions must update docs in lockstep.

## Capabilities

### New Capabilities

- `workflow-docs-contract-alignment`: ensures workflow protocol and helper docs are implementation-aligned and auditable.

### Modified Capabilities

- None.

## Impact

- Affects documentation only:
  - `doc/components/workflows.md`
  - `doc/components/workflow-hook-helpers.md`
  - related architecture/testing references as needed for traceability
- No runtime behavior changes.
- Reduces doc-implementation drift risk for workflow authors.

