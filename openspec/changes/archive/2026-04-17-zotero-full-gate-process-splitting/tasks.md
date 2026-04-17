## 1. OpenSpec and Governance

- [x] 1.1 Add a delta spec that records `full` as a sequential multi-process Zotero gate
- [x] 1.2 Record the tail-degradation findings and process-splitting rationale in governance docs

## 2. Full Gate Execution

- [x] 2.1 Add a Zotero full wrapper script that runs `core:full`, `ui:full`, and `workflow:full` sequentially
- [x] 2.2 Update package scripts so `test:zotero:full` uses the wrapper while keeping the external command stable
- [x] 2.3 Keep `test:gate:release` compatible without changing its external command surface

## 3. Validation

- [x] 3.1 Run `npx tsc --noEmit`
- [x] 3.2 Run `npm run test:zotero:full`
- [x] 3.3 Run `openspec validate zotero-full-gate-process-splitting --strict`
