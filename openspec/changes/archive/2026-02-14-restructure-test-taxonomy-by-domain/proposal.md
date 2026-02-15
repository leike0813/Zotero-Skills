## Why

Test coverage has expanded rapidly, but current organization makes it difficult to locate responsibility boundaries, assess regressions, and build stable suite gates.  
Tests need a consistent taxonomy before `lite/full` suite policies can be enforced.

## What Changes

- Regroup tests into three top-level domains:
  - `core`,
  - `ui`,
  - `workflow-*`.
- Define migration rules for existing tests, fixtures, and naming conventions.
- Define ownership and maintenance expectations for each domain.
- Produce a migration map from old structure to new taxonomy.

## Capabilities

### New Capabilities

- `test-taxonomy-domain-grouping`: Defines mandatory domain-based test classification, naming conventions, and migration mapping for the project test inventory.

### Modified Capabilities

- None.

## Impact

- Affects test directory structure and test documentation.
- Enables downstream `lite/full` suite and CI gate design.
- No runtime plugin behavior change.

