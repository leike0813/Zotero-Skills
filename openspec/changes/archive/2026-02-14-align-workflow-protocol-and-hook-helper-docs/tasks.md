## 1. Protocol Alignment Audit

- [x] 1.1 Compare `doc/components/workflows.md` against current workflow types/loader/runtime contracts
- [x] 1.2 Correct hook contract docs (including `normalizeSettings`) and request/build strategy notes
- [x] 1.3 Fix canonical reference-table column order documentation to match implementation

## 2. Hook Helpers API Reference Expansion

- [x] 2.1 Inventory all helper functions from `src/workflows/helpers.ts` and `HookHelpers` type
- [x] 2.2 Rewrite `doc/components/workflow-hook-helpers.md` into full API reference (signature, args, returns, behavior)
- [x] 2.3 Add examples for attachment filters, payload normalization, and table rendering helpers

## 3. Dialog/Editor Bridge Documentation

- [x] 3.1 Identify hook-facing dialog/editor bridge functions used by workflow hooks
- [x] 3.2 Add dedicated section documenting bridge API, sequencing, and failure/cancel semantics
- [x] 3.3 Clarify boundary: `runtime.helpers` vs non-helper hook bridge APIs

## 4. Drift Prevention and Verification

- [x] 4.1 Add documentation maintenance checklist for future helper/contract updates
- [x] 4.2 Cross-link updated docs from workflow component docs where appropriate
- [x] 4.3 Validate change via `openspec validate align-workflow-protocol-and-hook-helper-docs`
