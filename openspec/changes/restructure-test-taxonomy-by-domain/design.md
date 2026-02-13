## Context

Current test files are functionally useful but organizationally fragmented due to iterative feature delivery.  
As a result, the project lacks a stable domain taxonomy needed for predictable gate policy and targeted regression analysis.

## Goals / Non-Goals

**Goals:**

- Define a domain-based taxonomy: `core`, `ui`, `workflow-*`.
- Define migration rules for tests and fixtures.
- Define naming and classification standards for new tests.
- Preserve test intent during reorganization.

**Non-Goals:**

- Introducing new runtime features.
- Designing CI gate policy details (handled in a separate change).
- Rewriting all tests from scratch.

## Decisions

### Decision 1: Domain-first grouping with workflow namespace

- Workflow tests are grouped under `workflow-<id>` style namespaces.
- Core and UI remain stable cross-workflow domains.

### Decision 2: Fixture co-location by domain ownership

- Fixtures are migrated with their dominant domain to improve discoverability and reduce accidental coupling.

### Decision 3: Migration map as mandatory artifact

- Reorganization must include an old-to-new mapping table to preserve traceability and reviewability.

## Risks / Trade-offs

- [Risk] Reorganization can create temporary confusion in CI and local scripts  
  → Mitigation: keep compatibility aliases during migration window and document cutover.

- [Risk] Some tests span multiple domains  
  → Mitigation: assign primary domain and annotate cross-domain dependency in test doc comments.

- [Risk] Reviewer overhead increases during mass move  
  → Mitigation: separate pure move commits from behavior-changing commits in downstream implementation.

