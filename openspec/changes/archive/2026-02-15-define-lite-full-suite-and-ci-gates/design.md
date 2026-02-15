## Context

The project currently has many tests with varying runtime cost and environment requirements.  
A single undifferentiated gate either slows down PR throughput or weakens release confidence.  
The roadmap decision is fixed: PR executes `lite`; release executes `full`.

## Goals / Non-Goals

**Goals:**

- Define objective rules for `lite` vs `full` suite membership.
- Define deterministic scripts and CI wiring for both suites.
- Define failure severity handling and reporting behavior.
- Prune `lite` membership where possible to improve PR feedback speed.
- Constrain `selection-context rebuild` in `lite` to a deterministic top-3-parent subset derived from `selection-context-mix-all`.
- Minimize flakiness impact on daily PR flow while preserving release confidence.

**Non-Goals:**

- Rewriting tests in this change.
- Expanding coverage scope (handled in separate backlog changes).
- Changing plugin features.

## Decisions

### Decision 1: Risk-weighted suite partitioning

- `lite` includes fast, high-signal smoke/integration tests covering critical execution paths.
- `full` includes `lite` plus comprehensive regression and environment-dependent cases.
- `lite` must be actively pruned when tests become stable and low-risk at release depth only.

### Decision 2: Single source of suite membership metadata

- Suite membership is declared once and reused by scripts and CI jobs to avoid divergence.
- Domain-grouped command surface is limited to first-level taxonomy buckets only: `core`, `ui`, and `workflow`.
- `workflow` grouped commands cover all workflow-domain suites together; per-workflow command expansion is out of scope for this change.

### Decision 3: Explicit gate severity policy

- PR `lite` failures are blocking.
- Release `full` failures are blocking.
- Non-gating informational jobs may report warnings without blocking.

### Decision 4: Selection-context rebuild split for lite/full

- `full` keeps the existing comprehensive rebuild matrix.
- `lite` runs a dedicated fixture that contains only the first three parent entries from `selection-context-mix-all`.
- The dedicated `lite` fixture excludes standalone notes from `mix-all` to keep scope focused on parent rebuild behavior.
- The `lite` rebuild subset case keeps artifacts after execution (no teardown cleanup).

## Risks / Trade-offs

- [Risk] Incorrect suite partition can hide defects until release  
  → Mitigation: require critical-path smoke set inside `lite` and periodic review of escapes.

- [Risk] Metadata drift between scripts and CI  
  → Mitigation: centralize suite definitions and generate script references from that source.

- [Risk] Flaky tests can destabilize gates  
  → Mitigation: track flakiness and quarantine unstable cases from `lite` until fixed.

- [Risk] The top-3 subset fixture may drift from source `mix-all` fixture semantics  
  → Mitigation: document derivation rule and keep fixture regeneration/review steps in governance notes.
