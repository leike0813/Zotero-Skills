## 1. Seam Contract and Module Skeleton

- [x] 1.1 Define seam-level handoff types for preparation, run, apply, and feedback stages
- [x] 1.2 Create seam module skeletons and move non-behavioral shared helpers out of monolithic flow
- [x] 1.3 Keep `executeWorkflowFromCurrentSelection` as compatibility entrypoint delegating to seams

## 2. Preparation and Run Extraction (Behavior Parity)

- [x] 2.1 Extract request preparation logic into preparation seam with explicit outputs (`requests`, `skipped`, `executionContext`)
- [x] 2.2 Extract queue/provider lifecycle into run seam and remove inline orchestration duplication
- [x] 2.3 Add parity tests for no-valid-input and request-build failure branches

## 3. Apply and Feedback Extraction (Behavior Parity)

- [x] 3.1 Extract bundle/applyResult lifecycle into apply seam with deterministic error outcomes
- [x] 3.2 Extract start/job/finish notification and summary generation into feedback seam
- [x] 3.3 Add parity tests for mixed success/failure jobs and summary counters

## 4. Cleanup, Verification, and Hardening Gate

- [x] 4.1 Remove obsolete inline glue logic from `workflowExecute.ts`
- [x] 4.2 Run behavior parity regression (`test:node:full` and impacted zotero suites)
- [x] 4.3 Verify baseline acceptance gates: behavior parity, test parity, readability delta, traceability to HB-01
