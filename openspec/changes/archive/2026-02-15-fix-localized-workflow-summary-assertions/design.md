## Context

Workflow integration tests currently parse execution summary text with ad-hoc helpers.
Those helpers assume English tokens such as `succeeded=1`, while Zotero runtime can emit localized summaries such as `成功=1`.
This causes false negatives in Zotero-only runs even when workflow execution is correct.
The same parsing/assertion logic is duplicated across multiple workflow test domains, which increases drift risk.

## Goals / Non-Goals

**Goals:**

- Define one shared assertion entrypoint for workflow summary counts.
- Support at least English and Chinese summary tokens with equivalent semantics.
- Migrate workflow domains to the shared helper and remove duplicated local parsers.
- Keep assertion intent stable across Node and Zotero environments.

**Non-Goals:**

- Changing workflow runtime behavior or localized output content.
- Refactoring unrelated test architecture outside summary count assertions.
- Adding new workflow business coverage in this change.

## Decisions

### Decision 1: Canonical count keys with localized token aliases

- Use canonical assertion keys (`succeeded`, `failed`, `skipped`) for callers.
- Map localized summary labels (for example `成功`, `失败`, `跳过`) to canonical keys in one alias table.
- Parsing remains count-based and independent from surrounding prose.

### Decision 2: Shared helper as single test utility

- Introduce one shared helper for summary count assertion, used by workflow test suites.
- Helper accepts raw summary text and expected canonical counts.
- Failure diagnostics include raw summary text to ease debugging of locale-specific output.

### Decision 3: Incremental migration across workflow domains

- Update `workflow-reference-matching` first (known failing case), then align `workflow-literature-digest` and `workflow-reference-note-editor`.
- Remove local duplicated helpers once each suite is migrated.
- Keep existing test case semantics and only change assertion plumbing.

## Risks / Trade-offs

- [Risk] Additional locales may introduce unseen labels
  -> Mitigation: keep alias mapping centralized and easy to extend.

- [Risk] Parser may become too permissive and hide malformed summaries
  -> Mitigation: require explicit expected keys and fail when required counts are missing.

- [Risk] Migration touches multiple suites and may introduce import path mistakes
  -> Mitigation: run scoped Node and Zotero workflow suites after migration.
