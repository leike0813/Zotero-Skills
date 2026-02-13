## 1. Boundary Audit

- [x] 1.1 Inventory core modules in `src/**` that currently hold workflow settings/runtime logic
- [x] 1.2 Identify and document concrete workflow-business coupling points (with file references)
- [x] 1.3 Classify each finding as protocol-level-allowed vs business-coupling-disallowed

## 2. Extension Seam Implementation

- [x] 2.1 Define typed contract for workflow-specific settings normalization extension
- [x] 2.2 Add resolver/registry wiring so core can invoke workflow-owned normalizer logic
- [x] 2.3 Keep existing behavior parity for workflows without custom normalizer

## 3. Coupling Remediation

- [x] 3.1 Move known workflow-id keyed business normalization out of core modules
- [x] 3.2 Implement equivalent workflow-owned normalization path
- [x] 3.3 Remove dead/duplicated normalization branches in core

## 4. Verification and Regression Guard

- [x] 4.1 Add tests proving core path remains workflow-business-agnostic
- [x] 4.2 Add tests proving migrated workflow behavior is unchanged
- [x] 4.3 Add/refresh review checklist in architecture hardening docs
- [x] 4.4 Run `npm run test:node:full` and required targeted suites
