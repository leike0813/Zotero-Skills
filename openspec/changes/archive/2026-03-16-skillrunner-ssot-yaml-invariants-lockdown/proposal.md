## Why

SkillRunner provider SSOT and run-workspace SSOT are currently human-readable only. As behavior keeps evolving, doc/spec/code drift can happen silently and break state consistency guarantees.

This change turns the current implementation snapshot into machine-verifiable contracts so drift is blocked early in PR/release gates.

## What Changes

- Create machine-readable YAML invariants for two core SSOT domains:
  - provider state machine
  - global run workspace tabs
- Rewrite and harden the two SSOT documents with explicit invariant IDs and auditable rules.
- Add a bidirectional guard:
  - YAML <-> SSOT/OpenSpec reference consistency
  - YAML `current_value` <-> exported runtime facts consistency
- Wire invariant checks into CI blocking gates for both PR and release.

## Capabilities

### New Capabilities

- `skillrunner-ssot-yaml-invariants-governance`: Defines YAML invariants schema, cross-reference rules, and CI guard behavior for locking SkillRunner SSOT.

### Modified Capabilities

- `task-dashboard-skillrunner-observe`: Adds normative requirements that core SkillRunner observation behavior must be represented by machine-verifiable invariants and remain synchronized with implementation facts.

## Impact

- Affected areas:
  - `doc/components` (two SSOT docs + new YAML invariants)
  - `openspec/changes/skillrunner-ssot-yaml-invariants-lockdown/specs/**`
  - `scripts/check-skillrunner-ssot-invariants.ts`
  - `package.json`, `scripts/run-ci-gate.ts`
  - lightweight runtime-facts exports in SkillRunner modules
- No external API/event changes.
- Runtime behavior remains unchanged; governance strictness increases.
