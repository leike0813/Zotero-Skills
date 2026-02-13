## Why

`workflow loader` is now a critical stability boundary for M4 hardening.  
Current behavior already passes many tests, but contracts are still spread across manifest validation, hook resolution, runtime scan, and GUI integration paths.  
We need a dedicated hardening change to make loader contracts explicit, testable, and regression-resistant under refactor pressure.

## What Changes

- Define and enforce explicit loader contracts for:
  - manifest shape and required fields
  - hook file resolution and required hook presence
  - warning vs error classification
  - scan result determinism (order, dedup, fallback behavior)
- Separate pure validation/normalization logic from runtime scan side effects.
- Add a loader error taxonomy that normalizes user-facing diagnostics.
- Extend tests to cover malformed manifests, missing hooks, path edge-cases, and scan integration parity.

## Capabilities

### New Capabilities

- `workflow-loader-contract-hardening`: deterministic loader contracts with stable diagnostics and side-effect boundaries.

### Modified Capabilities

- Existing workflow scan/loading behavior is preserved, but implementation is hardened and contract-driven.

## Impact

- Affects:
  - `src/workflows/loader.ts`
  - workflow scan/registry integration in `src/modules/workflowRuntime.ts` and `src/modules/workflowMenu.ts`
  - loader-related test suites under `test/zotero/`
- No intended user-visible feature change.
- Primary baseline traceability: `HB-02`.
