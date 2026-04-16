- [x] Create `test-governance-three-axis-realignment` change artifacts.
- [x] Record the revised three-axis governance rules in:
  - [x] `artifact/test-governance-plan-v0.3.1.md`
  - [x] `doc/testing-framework.md`
  - [x] `doc/components/test-suite-governance.md`
- [x] Capture the first batch of parameterization merges:
  - [x] `test/workflow-reference-matching/24-workflow-reference-matching.test.ts`
  - [x] `test/workflow-literature-digest/21-workflow-literature-digest.test.ts`
  - [x] `test/ui/40-gui-preferences-menu-scan.test.ts`
  - [x] `test/node/core/20-workflow-loader-validation.test.ts`
- [x] Capture the first batch of runtime-affinity / `full-only` adjustments:
  - [x] `test/core/73-skillrunner-local-runtime-manager.test.ts`
  - [x] `test/core/70-skillrunner-task-reconciler.test.ts`
  - [x] `test/workflow-tag-regulator/64-workflow-tag-regulator.test.ts`
- [x] Split the remaining giant files:
  - [x] `test/core/70-skillrunner-task-reconciler.test.ts` ->
        `70a/70b/70c`
  - [x] `test/core/73-skillrunner-local-runtime-manager.test.ts` ->
        `73a/73b/73c`
  - [x] `test/workflow-tag-regulator/64-workflow-tag-regulator.test.ts` ->
        `64a/64b/64c`
- [x] Run validation:
  - [x] targeted mocha for split files
  - [x] targeted Zotero-safe verification where applicable
  - [x] `openspec validate test-governance-three-axis-realignment --strict`
  - [x] `npx tsc --noEmit`
