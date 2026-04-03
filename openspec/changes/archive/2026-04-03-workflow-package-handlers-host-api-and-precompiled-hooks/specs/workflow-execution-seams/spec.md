## MODIFIED Requirements

### Requirement: Workflow package hooks SHALL execute through a core host API facade

Workflow-package hooks MUST consume host capabilities through the plugin core `hostApi` facade rather than reading raw `Zotero`, `addon`, or bridge-carried globals.

#### Scenario: Package hook reads host capabilities

- **WHEN** a workflow-package hook needs prefs, items, editor, file, logging, or notification capabilities
- **THEN** the hook SHALL resolve them from `runtime.hostApi`
- **AND** the hook SHALL fail explicitly when `hostApi` or a required host capability is missing

### Requirement: Workflow package execution SHALL advertise precompiled host-hook contract

Package workflow diagnostics MUST describe the new precompiled host-hook contract instead of raw-runtime bridge metadata.

#### Scenario: Debug probe inspects a package workflow after migration

- **WHEN** workflow debug probe evaluates a workflow-package hook
- **THEN** the result includes `executionMode=precompiled-host-hook`
- **AND** the result includes `contract=package-host-api-facade`
- **AND** the result includes `hostApiVersion` and `hostApiSummary`
- **AND** the result SHALL NOT include raw Zotero shape or bridge/token carrier fields

### Requirement: Workflow package direct test/runtime helpers SHALL use the active host-api contract

Direct package helper tests and package-local utilities MUST execute under the same host-api contract used by production package hooks.

#### Scenario: Test invokes package-local helper without workflow execution pipeline

- **WHEN** a test directly invokes package-local helper code or renderer actions
- **THEN** it SHALL provide the active `hostApi` contract through runtime scope or host-api globals used by the package runtime adapter
- **AND** the test SHALL NOT depend on deprecated workflow runtime bridge shims
