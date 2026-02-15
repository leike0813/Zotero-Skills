## Why

After establishing suite strategy, known high-risk execution paths still need targeted test reinforcement.  
Without focused smoke/regression additions, `lite/full` gates may be structurally correct but operationally weak.

Current gap scan shows concrete uncovered or weakly-covered risk areas:

- High risk:
  - `backendManager` configuration validation/save flow lacks dedicated tests.
  - `workflowExecution/applySeam` key negative branches (`job missing`, `target parent unresolved`, `requestId missing`) are not directly asserted.
  - `workflows/declarativeRequestCompiler` guardrail branches are weakly covered for invalid selector and request-shape errors.
- Medium risk:
  - `loader` coverage for `normalizeSettings` hook diagnostics is incomplete.
  - `lite/full` superset policy is documented but lacks explicit enforcement checks.
  - Utility UI flows (`taskManagerDialog`, `selectionSample`) have low direct test coverage.

## What Changes

- Build a risk backlog with explicit IDs (`HR-*`, `MR-*`) and target test anchors.
- Add missing smoke tests for critical user-facing execution chains in high-risk modules.
- Add targeted regression tests for fragile or escaped behavior branches in runtime/compiler/loader layers.
- Add governance checks to keep `lite/full` expectations auditable and enforceable.
- Ensure each added test is assigned to `lite` or `full` based on risk and runtime cost.

## Capabilities

### New Capabilities

- `high-risk-regression-coverage`: Defines mandatory coverage reinforcement for high-risk paths through smoke and regression tests mapped to suite strategy.

### Modified Capabilities

- None.

## Impact

- Expands test inventory and fixture usage in prioritized areas.
- Adds risk-traceability artifacts for review and future regression planning.
- Improves gate confidence and reduces escaped defects.
- No runtime feature change.
