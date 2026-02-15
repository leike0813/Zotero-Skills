## Why

The roadmap requires a two-tier quality gate model (`PR=lite`, `release=full`), but this policy is not yet concretely defined in executable suite terms.  
Without explicit suite boundaries and CI gate semantics, regression risk remains unmanaged.
In addition, the current `lite` suite still carries cases that can be trimmed now that baseline stability has improved.

## What Changes

- Define `lite` suite scope for PR gating.
- Define `full` suite scope for release gating.
- Define inclusion/exclusion rules and depth rules (smoke/integration/e2e).
- Analyze existing tests and remove non-essential cases from `lite` to keep it fast and clean.
- Refine `selection-context rebuild` behavior in `lite`: run only a fixture derived from the first three parents of `selection-context-mix-all`.
- Keep rebuilt artifacts for the `lite` selection-context subset case (no cleanup after rebuild).
- Add grouped test commands for both Node and Zotero runs at first-level domains only: `core`, `ui`, `workflow`.
- Define CI gate behavior and failure severity policy (blocking vs warning).
- Define script and workflow conventions so suite execution is deterministic.

## Capabilities

### New Capabilities

- `test-suite-gating-strategy`: Defines normative suite membership and CI gate semantics for `lite` and `full` execution modes, including constrained `selection-context rebuild` behavior for `lite`.

### Modified Capabilities

- None.

## Impact

- Affects `package.json` test scripts, CI workflow definitions, and test governance documentation.
- Directly influences release confidence and PR feedback latency.
- No plugin runtime behavior changes.
