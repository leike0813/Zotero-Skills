## Why

M3 has accumulated multiple workflow/runtime/provider/editor subsystems, and future M4 work will increase coupling unless architecture boundaries and debt hotspots are explicitly audited.  
A hardening baseline is needed before feature expansion to reduce regression risk and rework.

## What Changes

- Create a formal architecture inventory covering:
  - workflow execution pipeline,
  - provider adapter and backend profile boundaries,
  - workflow hooks contract surface,
  - editor host framework boundaries.
- Identify and classify technical debt by risk and urgency.
- Produce a prioritized hardening backlog with explicit dependency order.
- Define refactor acceptance criteria (behavior parity, test parity, readability delta) for downstream changes.

## Capabilities

### New Capabilities

- `architecture-hardening-baseline`: Defines mandatory architecture inventory, debt classification, and hardening backlog outputs that gate downstream M4 implementation changes.

### Modified Capabilities

- None.

## Impact

- Planning/documentation artifacts under `doc/` and `openspec/` for architecture visibility.
- Future implementation changes for refactor and cleanup will reference this baseline.
- No runtime behavior change in this change itself.

