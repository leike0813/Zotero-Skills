## Why

After establishing suite strategy, known high-risk execution paths still need targeted test reinforcement.  
Without focused smoke/regression additions, `lite/full` gates may be structurally correct but operationally weak.

## What Changes

- Identify high-risk workflow/runtime/provider paths with historical failure patterns.
- Add missing smoke tests for critical user-facing execution chains.
- Add missing regression tests for known fragile or previously escaped scenarios.
- Ensure each added test is assigned to `lite` or `full` based on risk and runtime cost.

## Capabilities

### New Capabilities

- `high-risk-regression-coverage`: Defines mandatory coverage reinforcement for high-risk paths through smoke and regression tests mapped to suite strategy.

### Modified Capabilities

- None.

## Impact

- Expands test inventory and fixture usage in prioritized areas.
- Improves gate confidence and reduces escaped defects.
- No runtime feature change.

