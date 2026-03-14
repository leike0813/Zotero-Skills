## 1. OpenSpec and SSOT Artifacts

- [x] 1.1 Create proposal/design/spec/tasks for `localization-governance-ssot`
- [x] 1.2 Add component-level governance document in `doc/components`

## 2. Runtime Localization Governance

- [x] 2.1 Add shared localization fallback helper (locale detect + unresolved key detection + fallback)
- [x] 2.2 Migrate managed local backend display name path to helper and normalize legacy managed backend id
- [x] 2.3 Migrate local runtime toast fallback path to helper (no fixed-English fallback)

## 3. Automated Guardrails

- [x] 3.1 Add governance validator script for locale parity, duplicate allowlist, and required keys
- [x] 3.2 Integrate governance validator into CI gate flow

## 4. Tests and Verification

- [x] 4.1 Add/extend tests for managed local backend display name legacy-id mapping
- [x] 4.2 Add/extend tests for locale-aware toast fallback behavior
- [x] 4.3 Run `npx tsc --noEmit`
- [x] 4.4 Run targeted core tests for dashboard snapshot and local runtime manager
