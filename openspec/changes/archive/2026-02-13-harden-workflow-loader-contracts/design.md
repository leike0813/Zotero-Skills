## Context

Workflow loading is used by startup, rescans, and GUI menu rendering.  
A small contract drift in loader behavior can cascade into missing workflows, stale menu states, or unclear diagnostics.  
This change hardens loader contracts without changing product behavior.

## Goals / Non-Goals

**Goals**

- Make loader contracts explicit and centralized.
- Preserve current observable behavior and compatibility.
- Improve fault diagnostics and test determinism.
- Isolate pure validation from IO/runtime side effects.

**Non-Goals**

- Adding new workflow schema features.
- Changing workflow authoring UX.
- Refactoring unrelated runtime execution paths.

## Decisions

### Decision 1: Introduce Loader Contract Layers

Split loader flow into stable layers:

- `manifest parse/validate`
- `hook resolution/validation`
- `loaded workflow normalization`
- `scan summary aggregation`

Each layer has explicit input/output types and cannot mutate shared hidden state.

### Decision 2: Stable Error/Warning Taxonomy

Define normalized categories:

- `manifest_parse_error`
- `manifest_validation_error`
- `hook_missing_error`
- `hook_import_error`
- `scan_path_error`
- `scan_runtime_warning`

GUI/scan messaging consumes category + normalized reason, not raw thrown shape.

### Decision 3: Deterministic Loader Result Ordering

Maintain deterministic ordering of loaded workflows, warnings, and errors for repeatable tests and predictable UI behavior.

### Decision 4: Behavior Parity Gate

No change in successful load outcomes for valid workflows; no regression in existing startup/scan/menu tests.

## Risks / Trade-offs

- [Risk] Contract extraction may accidentally alter warning/error classification.  
  Mitigation: parity tests on existing fixtures and startup scan scenarios.

- [Risk] More abstraction can obscure debugging.  
  Mitigation: keep loader contract helpers small and directly mapped to categories.

## Migration Plan

1. Extract loader contract helpers with no behavior change.
2. Route existing loader through helpers and normalized taxonomy.
3. Update/add tests for category and deterministic outputs.
4. Verify full node test parity and impacted zotero suites.

## Acceptance Gates (Inherited)

- Behavior parity
- Test parity
- Readability delta
- Traceability to `HB-02`
