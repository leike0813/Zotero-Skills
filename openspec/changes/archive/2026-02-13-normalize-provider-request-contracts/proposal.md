## Why

`HB-03` (Provider/request contract normalization) is the next hardening item after execution seams and loader contracts.
Current provider behavior is functionally stable, but request contract checks are split across:

- declarative compiler
- runtime request preparation
- provider registry resolution
- provider execution entrypoints

This spread increases drift risk as request kinds grow (`generic-http.request.v1`, `generic-http.steps.v1`, `pass-through.run.v1`) and makes diagnostics less predictable.

## What Changes

- Introduce a normalized provider-request contract layer as single-source boundary logic.
- Unify validation flow for:
  - request kind support
  - backend/provider compatibility
  - request payload minimum shape
- Normalize provider-request diagnostics into stable categories and messages.
- Preserve behavior parity for all currently valid workflows.
- Add regression coverage for contract mismatch and parity paths.

## Capabilities

### New Capabilities

- `provider-request-contract-normalization`: centralized, deterministic provider-request contract validation and diagnostics.

### Modified Capabilities

- Existing provider execution paths keep current behavior, but validation and failure classification become contract-driven.

## Impact

- Affects:
  - `src/providers/contracts.ts`
  - `src/providers/registry.ts`
  - `src/workflows/declarativeRequestCompiler.ts`
  - `src/workflows/runtime.ts`
  - provider-related tests under `test/zotero/`
- No intended user-visible feature change.
- Primary baseline traceability: `HB-03`.
