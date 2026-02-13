## Why

The current workflow execution path is heavily concentrated in `workflowExecute.ts`, mixing trigger validation, request construction, queue execution, result application, logging, and user messaging.  
Before expanding M4 features, execution seams must be refactored into explicit modules so changes can be made safely without increasing regression risk.

## What Changes

- Refactor workflow execution orchestration into explicit seams with single-purpose modules:
  - trigger and request preparation seam,
  - provider run coordination seam,
  - apply-result seam,
  - finish-summary and notification seam.
- Introduce a stable execution context contract shared across seams.
- Reduce direct cross-calls by introducing seam-level handoff objects and dependency injection points.
- Preserve observable runtime behavior (messages, skipped/succeeded/failed counting, task records, logs).
- Add/adjust tests to verify behavioral parity through the refactor.

## Capabilities

### New Capabilities

- `workflow-execution-seams`: Defines modular seam boundaries and behavior-preserving contracts for workflow execution orchestration.

### Modified Capabilities

- None.

## Impact

- Affects:
  - `src/modules/workflowExecute.ts`
  - `src/workflows/runtime.ts`
  - related execution/log/message modules
  - execution-oriented test suites
- No intentional user-visible behavior change.
- Enables later hardening changes (HB-02/HB-03/HB-04) with lower coupling risk.

