## Context

Provider execution is a core runtime boundary (Boundary B).  
At present, request contract checks are scattered and partially duplicated across compiler/runtime/provider layers.  
This change hardens contract normalization without introducing new request kinds.

## Goals / Non-Goals

**Goals**

- Centralize provider-request contract checks into explicit reusable helpers.
- Keep behavior parity for all existing valid workflows.
- Produce stable, normalized diagnostics for contract failures.
- Reduce cross-layer duplication between compiler/runtime/provider registry.

**Non-Goals**

- Adding new request kinds.
- Changing workflow authoring UX.
- Refactoring unrelated execution orchestration.

## Decisions

### Decision 1: Single Contract Normalization Layer

Create a contract module that owns:

- request kind to provider/backend compatibility matrix
- minimum payload constraints per request kind
- normalized diagnostic categories and reason mapping

Compiler/runtime/provider entrypoints consume this layer instead of re-encoding rules.

### Decision 2: Two-phase Validation With Shared Semantics

Apply shared semantics in two phases:

- **Compile/runtime preparation phase**: validate request declaration shape and normalize obvious contract mismatches early.
- **Provider dispatch phase**: re-validate compatibility against resolved backend/provider to prevent drift and ensure defense-in-depth.

### Decision 3: Stable Error Taxonomy

Use deterministic categories for contract failures, e.g.:

- `provider_contract_error`
- `provider_backend_mismatch`
- `request_kind_unsupported`
- `request_payload_invalid`

User-facing summaries and logs consume normalized category/reason pairs.

### Decision 4: Behavior Parity Gate

No changes to successful execution outcomes for existing valid workflow fixtures:

- `generic-http.request.v1`
- `generic-http.steps.v1`
- `pass-through.run.v1`

## Risks / Trade-offs

- [Risk] Over-normalization may change legacy error text unexpectedly.  
  Mitigation: keep normalized reason deterministic and assert on compatibility in tests.

- [Risk] Multi-layer checks could diverge if not reused strictly.  
  Mitigation: all call sites consume the same contract helper APIs.

## Migration Plan

1. Extract contract helper module and types.
2. Integrate runtime/provider registry validation through shared helper.
3. Align compiler/runtime error mapping with normalized categories.
4. Add parity and mismatch regression tests.
5. Run node full test suite and impacted Zotero suites.

## Acceptance Gates (Inherited)

- Behavior parity
- Test parity
- Readability delta
- Traceability to `HB-03`
