## Why

The roadmap requires a two-tier quality gate model (`PR=lite`, `release=full`), but this policy is not yet concretely defined in executable suite terms.  
Without explicit suite boundaries and CI gate semantics, regression risk remains unmanaged.

## What Changes

- Define `lite` suite scope for PR gating.
- Define `full` suite scope for release gating.
- Define inclusion/exclusion rules and depth rules (smoke/integration/e2e).
- Define CI gate behavior and failure severity policy (blocking vs warning).
- Define script and workflow conventions so suite execution is deterministic.

## Capabilities

### New Capabilities

- `test-suite-gating-strategy`: Defines normative suite membership and CI gate semantics for `lite` and `full` execution modes.

### Modified Capabilities

- None.

## Impact

- Affects `package.json` test scripts, CI workflow definitions, and test governance documentation.
- Directly influences release confidence and PR feedback latency.
- No plugin runtime behavior changes.

