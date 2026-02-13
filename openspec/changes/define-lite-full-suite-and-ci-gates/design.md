## Context

The project currently has many tests with varying runtime cost and environment requirements.  
A single undifferentiated gate either slows down PR throughput or weakens release confidence.  
The roadmap decision is fixed: PR executes `lite`; release executes `full`.

## Goals / Non-Goals

**Goals:**

- Define objective rules for `lite` vs `full` suite membership.
- Define deterministic scripts and CI wiring for both suites.
- Define failure severity handling and reporting behavior.
- Minimize flakiness impact on daily PR flow while preserving release confidence.

**Non-Goals:**

- Rewriting tests in this change.
- Expanding coverage scope (handled in separate backlog changes).
- Changing plugin features.

## Decisions

### Decision 1: Risk-weighted suite partitioning

- `lite` includes fast, high-signal smoke/integration tests covering critical execution paths.
- `full` includes `lite` plus comprehensive regression and environment-dependent cases.

### Decision 2: Single source of suite membership metadata

- Suite membership is declared once and reused by scripts and CI jobs to avoid divergence.

### Decision 3: Explicit gate severity policy

- PR `lite` failures are blocking.
- Release `full` failures are blocking.
- Non-gating informational jobs may report warnings without blocking.

## Risks / Trade-offs

- [Risk] Incorrect suite partition can hide defects until release  
  → Mitigation: require critical-path smoke set inside `lite` and periodic review of escapes.

- [Risk] Metadata drift between scripts and CI  
  → Mitigation: centralize suite definitions and generate script references from that source.

- [Risk] Flaky tests can destabilize gates  
  → Mitigation: track flakiness and quarantine unstable cases from `lite` until fixed.

