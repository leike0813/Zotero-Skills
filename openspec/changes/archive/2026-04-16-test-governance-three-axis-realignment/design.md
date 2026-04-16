# Design: test-governance-three-axis-realignment

## 1. Core Decision

This change realigns test governance with the repository's current operating
model instead of introducing a new one.

The governing axes are:

1. execution cost: `lite` / `full`
2. runtime affinity: `node-only` / `zotero-safe` / `zotero-unsafe`
3. governance-only value labels: `critical` / `standard`

`critical/standard` remain documentation labels only. They do not become runner
contracts.

## 2. Suite Gating Model

- `full` remains a strict superset of `lite`
- `itFullOnly` remains the supported case-level gating mechanism
- no `itLiteOnly`, no new runner, and no metadata compiler are introduced
- parameterization is allowed only when the grouped cases share the same
  execution mode and runtime affinity

## 3. Runtime Affinity Model

The change formalizes a rule that was already emerging from recent fixes:

- `node-only`
  - package-helper tests
  - runtime seam tests
  - mock-heavy tests
  - fake DOM / renderer-detail tests
- `zotero-safe`
  - tests that can run in Zotero without opening real editor, picker, or
    dialog UI
- `zotero-unsafe`
  - tests whose natural execution may open real UI or depend on unstable
    multi-realm injection behavior

Zotero-safe regular regression runs must not include real editor, file picker,
or dialog openings.

## 4. Implemented Governance Scope

This change covers both already-landed governance work and the remaining file
splits.

Already completed and recorded by this change:

- governance document rewrite
- first batch of parameterization merges
- first batch of `full-only` / `node-only` / Zotero-safe adjustments

Still implemented under this same change:

- `70` split into state-restore / apply-bundle-retry / ledger-reconcile
- `73` split into deploy-lifecycle / oneclick-start-stop / auto-start-session
- `64` split into request-building / apply-intake / dialog-rendering

## 5. Giant File Split Rules

The split keeps behavior stable and only changes file boundaries.

Rules:

- preserve numeric prefix and add `a/b/c`
- each new file keeps local helpers only for the cases it owns
- no cross-file hidden state
- original giant file is removed after split
- `64c` defaults to `node-only` / Zotero-unsafe concerns

## 6. Non-goals

- no new runner
- no change to `npm run test:*` contract
- no metadata enforcement pipeline
- no large-scale assertion-style rewrite
- no broad test deletion campaign
