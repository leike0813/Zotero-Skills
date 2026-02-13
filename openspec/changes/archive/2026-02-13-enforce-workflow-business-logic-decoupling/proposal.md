## Why

After `decouple-workflow-settings-domain`, the codebase still has a boundary ambiguity:  
plugin core modules under `src/**` occasionally carry workflow-specific business rules (for example, workflow-id keyed normalization).
This weakens the pluggable architecture target and makes future workflow additions riskier.

## What Changes

- Define and enforce a clear decoupling boundary:
  - `src/**` MAY contain protocol-level generic logic (request kind/provider/backend/profile orchestration).
  - `src/**` MUST NOT contain concrete workflow business semantics keyed by workflow id or workflow-specific field rules.
- Audit current implementation for boundary violations and classify findings by severity.
- Introduce an approved extension mechanism so workflow-specific settings normalization/validation can live outside core.
- Migrate currently identified workflow-specific logic in core to the extension path.
- Add regression tests and a review checklist to prevent reintroduction.

## Capabilities

### New Capabilities
- `workflow-business-decoupling-boundary`: defines enforceable architecture boundaries and extension points between plugin core and workflow-specific business logic.

### Modified Capabilities
- `workflow-execution-seams`: add boundary responsibility clarity so seams remain protocol-level and workflow-agnostic.

## Impact

- Affects:
  - `src/modules/workflowSettings*.ts`
  - `src/modules/workflowExecution/*`
  - provider/runtime wiring for settings normalization hooks
  - workflow-side hook usage contracts
- Adds:
  - boundary audit artifacts and anti-regression tests
  - maintainers’ review checklist for architecture decoupling
