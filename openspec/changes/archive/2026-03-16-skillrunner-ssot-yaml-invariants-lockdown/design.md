## Context

Current SkillRunner behavior is already constrained by implementation guards (state-write sources, backend health gating, stream lifecycle, and UI gating). However, these constraints are fragmented across docs/spec/code and can drift independently.

The project already has governance scripts (localization and builtin workflow manifest), so adding a dedicated SSOT invariant guard follows existing governance patterns.

## Goals / Non-Goals

**Goals:**

- Encode current SkillRunner core behavior into machine-readable YAML invariants.
- Make two core SSOT docs explicit, auditable, and referentially stable via invariant IDs.
- Guarantee doc/spec/code consistency through one blocking script integrated into PR/release gates.
- Avoid behavior changes while hardening governance.

**Non-Goals:**

- No runtime feature changes or new end-user interactions.
- No expansion to local runtime SSOT in this change.
- No replacement of existing test suite strategy; this is a governance layer complement.

## Decisions

### 1) Invariants source files

- Two YAML files under `doc/components/`:
  - `skillrunner-provider-state-machine-ssot.invariants.yaml`
  - `skillrunner-provider-global-run-workspace-tabs-ssot.invariants.yaml`
- Rationale:
  - keeps invariants physically adjacent to SSOT docs
  - reduces ownership ambiguity
  - keeps review diffs local and readable

Alternative considered:

- Storing YAML under `openspec/specs/` only.
  - Rejected because SSOT doc authorship and invariant lifecycle are primarily component-doc-centric.

### 2) Invariant schema and reference contract

Each invariant entry uses:

- `id`
- `domain`
- `type`
- `current_value`
- `code_refs`
- `doc_refs`
- `spec_refs`
- `must`

Contract:

- each `id` must be unique globally across the two YAML files
- each `id` must appear in referenced SSOT/spec files
- each `code_refs` target must resolve to an exported runtime-facts value
- `current_value` must deep-equal the resolved runtime fact

### 3) Runtime facts export strategy

- Add lightweight export module `skillRunnerSsoFacts.ts`.
- Export only stable behavior constants used by invariants:
  - state sets
  - terminal sets
  - write-source rules
  - backend health probe cadence/thresholds
  - stream lifecycle gates
  - startup reconnect scope
  - backend-flagged UI gates

Rationale:

- avoids brittle regex/text scraping in scripts
- turns implementation facts into explicit governance surface
- avoids semantic changes in runtime logic

### 4) CI gate policy

- Add `check:ssot-invariants` script.
- Run in `scripts/run-ci-gate.ts` for both PR and release before test suite.
- Any mismatch is blocking.

Rationale:

- requirement is “lock behavior,” so warnings are insufficient
- aligns with existing governance checks that are already blocking

## Risks / Trade-offs

- [Risk] Invariant set becomes stale when implementation changes quickly  
  → Mitigation: block CI and require synchronized updates (YAML + SSOT + spec + facts exports).

- [Risk] Over-constraining implementation refactor flexibility  
  → Mitigation: keep invariants focused on behavior-level constants and contracts, not private internal shapes.

- [Risk] Script false negatives from weak references  
  → Mitigation: use explicit exported facts and deterministic deep-equality checks.

## Migration Plan

1. Create change artifacts and delta specs.
2. Rewrite two SSOT docs with invariant IDs and auditable rule blocks.
3. Add YAML invariants files and runtime facts export module.
4. Add validation script and CI wiring.
5. Run:
   - `npm run check:ssot-invariants`
   - `npx tsc --noEmit`
   - `openspec validate --change "skillrunner-ssot-yaml-invariants-lockdown" --strict --no-interactive`

Rollback:

- Revert this change set; runtime behavior remains unchanged because this change is governance-focused.

## Open Questions

- None for this scope. Decisions are locked by this design.
