## Core Settings/Runtime Boundary Audit

### Inventory (`src/**` settings/runtime ownership)

- `src/modules/workflowSettings.ts`
  - Responsibility: settings persistence IO, run-once overrides, execution context merge
- `src/modules/workflowSettingsDomain.ts`
  - Responsibility: schema-driven generic normalization and merge helpers
- `src/modules/workflowSettingsDialog.ts`
  - Responsibility: UI rendering and user interaction for settings
- `src/workflows/loader.ts`
  - Responsibility: workflow manifest/hook loading
- `src/modules/workflowRuntime.ts`
  - Responsibility: loaded workflow registry and rescan lifecycle

### Coupling Findings

1. `src/modules/workflowSettingsDomain.ts` had concrete business branching:
   - `REFERENCE_MATCHING_WORKFLOW_ID = "reference-matching"`
   - `citekey_template` fallback + BBT-Lite parser/validator hardcoded in core
2. `src/modules/workflowSettings.ts` delegated persisted normalization to domain function that encoded workflow-specific semantics.

### Classification

- **Protocol-level allowed**
  - provider/backend/profile resolution
  - schema-driven type/enum/min/max coercion
  - run-once/persisted merge precedence
- **Business-coupling disallowed**
  - hardcoded workflow id checks in core
  - workflow field semantics (`citekey_template`) in core

### Remediation in this change

- Added extension seam: optional `hooks.normalizeSettings` in workflow manifest/hook contract.
- Migrated reference-matching citekey template validation/fallback logic to:
  - `workflows/reference-matching/hooks/normalizeSettings.js`
- Removed workflow-id business branching from `src/modules/workflowSettingsDomain.ts`.
