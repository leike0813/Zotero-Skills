## 1. Domain Contract Extraction

- [x] 1.1 Define settings-domain contract types for persisted, run-once, and execution-ready settings
- [x] 1.2 Extract pure domain helpers from `workflowSettings.ts` (load/save/merge/normalize)
- [x] 1.3 Keep existing persistence schema and public entry behavior-compatible

## 2. Dialog-to-Domain Boundary Refactor

- [x] 2.1 Refactor `workflowSettingsDialog.ts` to consume domain APIs for initialization and save/apply flows
- [x] 2.2 Remove duplicated merge/normalization logic from dialog layer
- [x] 2.3 Keep user-visible messaging and interaction flow unchanged

## 3. Regression Coverage and Parity

- [x] 3.1 Add domain-level tests for reset-on-open, merge precedence, and normalization/fallback semantics
- [x] 3.2 Keep existing settings execution integration tests passing without behavior drift
- [x] 3.3 Validate impacted node/zotero suites for parity

## 4. Hardening Gate Closure

- [x] 4.1 Confirm behavior parity/no UX drift in workflow settings flows
- [x] 4.2 Confirm readability delta (domain vs UI responsibilities clear)
- [x] 4.3 Record traceability to baseline item `HB-04`
