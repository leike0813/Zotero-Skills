## Context

The repository has evolved into a workflow-oriented Zotero plugin project, but the root README still reflects the initial template. Existing docs under `doc/` contain implementation details, yet there is no concise top-level project narrative for external readers.

The new README should be:

- English-first for broad accessibility,
- explicit about Chinese documentation entry,
- aligned with current architecture and dependency boundaries,
- focused on practical usage value.

## Goals / Non-Goals

**Goals:**

- Provide a concise English README aligned with current project reality.
- Highlight pluggable workflow architecture and why it matters.
- Clearly state Skill-Runner dependency for Agent Skills invocation.
- Explain the cost-model benefit of using subscription quotas rather than direct API token billing.
- Keep attribution to Zotero Plugin Template origin.
- Provide Chinese documentation link (`doc/README-zhCN.md`).

**Non-Goals:**

- No code or runtime behavior changes.
- No redesign of `doc/README-zhCN.md` content.
- No workflow/spec/runtime implementation updates.

## Decisions

### Decision 1: English README as canonical root entry

- Root `README.md` is rewritten in English.
- Chinese readers are routed via explicit link to `doc/README-zhCN.md`.

### Decision 2: Replace template text instead of incremental patching

- Remove template-generated feature/demo sections that do not describe this project.
- Keep one explicit attribution line that the project was generated from Zotero Plugin Template.

### Decision 3: Structure README by user intent

Recommended sections:

1. What Zotero-Skills is
2. Key architecture (pluggable workflows)
3. Skill-Runner requirement for Agent Skills
4. Why this integration model is cost-effective
5. Typical usage scenarios
6. Quick start pointers
7. Chinese documentation link
8. Template origin attribution

## Risks / Trade-offs

- Over-compression risk: if too concise, readers may miss technical boundaries.
  - Mitigation: include direct links to detailed docs under `doc/`.
- Future drift risk: README can become stale as capabilities evolve.
  - Mitigation: keep README conceptual and link behavior details to component docs.

## Migration Plan

1. Add OpenSpec artifacts for this documentation change.
2. Rewrite `README.md` based on approved structure and messaging.
3. Verify links and wording consistency with existing docs.
