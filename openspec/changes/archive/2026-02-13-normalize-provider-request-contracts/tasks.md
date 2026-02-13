## 1. Contract Boundary Extraction

- [x] 1.1 Define provider-request contract types and compatibility matrix as a shared module
- [x] 1.2 Extract minimum request payload validators by request kind
- [x] 1.3 Keep public runtime/provider entry behavior-compatible

## 2. Validation and Diagnostics Normalization

- [x] 2.1 Route compiler/runtime/provider-registry checks through shared contract helpers
- [x] 2.2 Implement normalized provider-request diagnostic categories and deterministic reason mapping
- [x] 2.3 Ensure fallback/error flows remain stable for user-facing summaries

## 3. Parity Coverage

- [x] 3.1 Add regression tests for request kind unsupported and provider-backend mismatch
- [x] 3.2 Add regression tests for request payload invalid per request kind
- [x] 3.3 Verify valid workflows (`generic-http.request.v1`, `generic-http.steps.v1`, `pass-through.run.v1`) remain load/execute-equivalent

## 4. Hardening Gate Closure

- [x] 4.1 Validate full node test parity and impacted Zotero suites
- [x] 4.2 Confirm behavior parity/no UX drift in provider-driven flows
- [x] 4.3 Record traceability to baseline item `HB-03`
