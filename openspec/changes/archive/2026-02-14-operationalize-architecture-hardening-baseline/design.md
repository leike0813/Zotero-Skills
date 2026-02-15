## Context

The architecture hardening baseline is complete and now serves as a single source of risk, debt, and hardening work items (HB-01~HB-09).  
At the same time, several implementation-oriented changes already exist (`restructure-test-taxonomy-by-domain`, `define-lite-full-suite-and-ci-gates`, `add-high-risk-smoke-and-regression-tests`, `improve-code-and-test-reviewability`).  
Without a formal operational mapping layer, execution can drift, overlap, or leave gaps across HB items.

## Goals / Non-Goals

**Goals:**

- Define a deterministic method to interpret baseline items into implementation change candidates.
- Produce a concrete mapping matrix from HB-01~HB-09 to actual OpenSpec changes.
- Declare dependency-aware execution waves with explicit gating criteria.
- Define per-change acceptance inheritance from the baseline checklist.

**Non-Goals:**

- Implementing refactor/test/code changes for HB items.
- Re-scoring debt in this change.
- Replacing the baseline document itself.

## Decisions

### Decision 1: Use baseline HB item as the primary decomposition unit

- Every downstream hardening change must map to at least one HB item.
- Each HB item can map to one or more changes, but each change must have a primary HB owner.

### Decision 2: Use wave-based execution for dependency control

- `Wave-1` (architecture seams/contracts): HB-01, HB-02, HB-03, HB-04.
- `Wave-2` (UI/settings + bridge cleanup): HB-05, HB-06.
- `Wave-3` (test system and parity): HB-07, HB-08.
- `Wave-4` (docs consolidation and closure): HB-09.

### Decision 3: Preserve and reuse existing in-progress changes when valid

- Existing changes are reused if their scope aligns to HB mappings.
- New changes are opened only for missing HB coverage, avoiding duplicate planning artifacts.

### Decision 4: Acceptance gate inheritance is mandatory

- Every mapped change inherits baseline gates:
  - behavior parity,
  - test parity,
  - readability delta,
  - traceability to baseline item IDs.

### Decision 5: Mapping output is apply-ready portfolio, not implementation detail

- This change outputs actionable change portfolio definitions and sequencing only.
- Code-level design stays inside each individual downstream change.

## HB-to-Change Mapping Matrix

| HB Item | Coverage Mode | Change(s) | Coverage Notes |
|---|---|---|---|
| HB-01 Runtime orchestration seams | New | `refactor-workflow-execution-seams` (to open) | Split `workflowExecute` responsibilities and seam extraction plan |
| HB-02 Loader contract hardening | New | `harden-workflow-loader-contracts` (to open) | Runtime parity, manifest validation and hook loading path stability |
| HB-03 Provider/request contract normalization | New | `normalize-provider-request-contracts` (to open) | Align contracts/compiler/registry and reduce drift |
| HB-04 Settings domain decoupling | New | `decouple-workflow-settings-domain` (to open) | Separate normalization/validation/persistence concerns |
| HB-05 Settings dialog render-model split | New | `split-workflow-settings-dialog-model` (to open) | Reduce UI module coupling and improve testability |
| HB-06 Global runtime bridge cleanup | New | `consolidate-runtime-global-bridges` (to open) | Centralize global bridge access (`ztoolkit`, host bridge, globals) |
| HB-07 Test taxonomy + suite alignment | Reuse | `restructure-test-taxonomy-by-domain`, `define-lite-full-suite-and-ci-gates` | Existing in-progress changes become primary HB-07 carriers |
| HB-08 Mock parity governance | Partial reuse + new | `add-high-risk-smoke-and-regression-tests` + `govern-zotero-mock-parity` (to open) | Existing change covers risk tests; new change covers parity governance contract |
| HB-09 Hardening doc consolidation | Reuse | `improve-code-and-test-reviewability` | Existing change expanded with hardening review cross-links/checklist usage |

## Execution Waves

- **Wave-1 (Foundations):** HB-01, HB-02, HB-03, HB-04
- **Wave-2 (UI/Bridge):** HB-05, HB-06
- **Wave-3 (Test System):** HB-07, HB-08
- **Wave-4 (Consolidation):** HB-09

Parallelism rule:

- Wave-internal parallelism is allowed only when `DependsOn` from baseline is satisfied.
- No Wave-N+1 primary implementation starts before all Wave-N gating dependencies are closed.

## Risks / Trade-offs

- [Risk] Mapping granularity is too coarse and mixes unrelated work  
  → Mitigation: enforce "one primary HB owner per change" and split when ownership becomes ambiguous.

- [Risk] Existing in-progress changes may only partially cover target HB items  
  → Mitigation: annotate partial coverage and open follow-up delta changes for residual scope.

- [Risk] Wave sequencing may slow urgent fixes  
  → Mitigation: allow urgent patch changes outside waves, but require post-hoc HB trace linkage.

## Migration Plan

1. Produce the HB->change mapping matrix and wave plan in this change.
2. Confirm reuse vs new-open decisions for each HB item.
3. Open missing dedicated changes for uncovered HB scopes.
4. Treat this operationalization change as the control-plane reference for Week 1-3 execution.

## Open Questions

- None at planning level; implementation ambiguity is deferred to each mapped change.
