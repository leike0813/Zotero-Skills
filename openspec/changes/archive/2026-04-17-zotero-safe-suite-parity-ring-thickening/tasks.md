## 1. Allowlist Thickening

- [x] 1.1 Split Zotero routine allowlists into `lite` and `full extra` rings
- [x] 1.2 Add regression coverage for `lite`-only and `full`-only allowlist decisions

## 2. Mixed-Suite Gating

- [x] 2.1 Restore selected real-host parity cases to Zotero `lite`
- [x] 2.2 Restore selected guard/idempotency/parity cases to Zotero `full`
- [x] 2.3 Keep all non-restored cases on Node-only coverage paths

## 3. Governance Recording

- [x] 3.1 Record the new Zotero `lite` retained list in governance docs
- [x] 3.2 Record the Zotero `full` extra parity list in governance docs
- [x] 3.3 Add OpenSpec artifacts and delta specs for the new `lite/full` parity-ring contract

## 4. Validation

- [x] 4.1 Run targeted Node regressions for all re-layered files
- [x] 4.2 Run Zotero `core/ui/workflow` in both `lite` and `full`
- [x] 4.3 Run `openspec validate zotero-safe-suite-parity-ring-thickening --strict` and `npx tsc --noEmit`
