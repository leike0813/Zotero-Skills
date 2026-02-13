## 1. Contract Extraction

- [x] 1.1 Define loader contract types for manifest validation, hook resolution, and normalized diagnostics
- [x] 1.2 Extract pure contract helpers from loader runtime flow
- [x] 1.3 Keep public loader entrypoints behavior-compatible

## 2. Classification and Determinism

- [x] 2.1 Implement normalized loader error/warning taxonomy
- [x] 2.2 Ensure deterministic ordering for loaded workflows and diagnostics
- [x] 2.3 Add regression tests for malformed manifest and missing hook classifications

## 3. Integration Parity

- [x] 3.1 Add parity tests for startup scan/menu integration with hardened loader
- [x] 3.2 Verify existing valid workflow fixtures remain load-equivalent
- [x] 3.3 Validate full node test parity and impacted zotero suites

## 4. Hardening Gate Closure

- [x] 4.1 Confirm behavior parity/no UX drift in loader-driven flows
- [x] 4.2 Confirm test parity and readability delta
- [x] 4.3 Record traceability to baseline item `HB-02`
