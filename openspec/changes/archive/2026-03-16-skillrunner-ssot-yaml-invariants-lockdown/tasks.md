## 1. OpenSpec Artifacts

- [x] 1.1 Create `proposal.md` with capability declaration and scope lock.
- [x] 1.2 Create `design.md` with invariant model, guard rules, and CI policy.
- [x] 1.3 Create delta specs for new governance capability and modified dashboard-skillrunner observe capability.

## 2. SSOT Revision (Core Two Docs)

- [x] 2.1 Rewrite `skillrunner-provider-state-machine-ssot.md` with explicit invariant IDs and auditable rule blocks.
- [x] 2.2 Rewrite `skillrunner-provider-global-run-workspace-tabs-ssot.md` with matching invariant IDs and event/render contracts.

## 3. YAML Invariant Contracts

- [x] 3.1 Add provider invariants YAML file with required fields and fixed IDs.
- [x] 3.2 Add workspace invariants YAML file with required fields and fixed IDs.
- [x] 3.3 Ensure each invariant entry links to doc/spec/code references.

## 4. Guard Script + Runtime Facts

- [x] 4.1 Add runtime facts export module for stable behavior constants.
- [x] 4.2 Add `scripts/check-skillrunner-ssot-invariants.ts` for schema/reference/facts validation.
- [x] 4.3 Add npm script and CI gate wiring (`run-ci-gate.ts`) as blocking checks.

## 5. Verification

- [x] 5.1 Run `npm run check:ssot-invariants`.
- [x] 5.2 Run `npx tsc --noEmit`.
- [x] 5.3 Run `openspec validate "skillrunner-ssot-yaml-invariants-lockdown" --type change --strict --no-interactive`.
