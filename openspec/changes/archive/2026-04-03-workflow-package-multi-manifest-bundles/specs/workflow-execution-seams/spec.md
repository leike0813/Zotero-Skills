## ADDED Requirements

### Requirement: Workflow loader SHALL support multi-workflow packages

The workflow loader SHALL support a package root that declares multiple child workflow manifests while remaining compatible with the existing single-workflow directory format.

#### Scenario: Package root yields multiple loaded workflows

- **WHEN** a workflow directory contains `workflow-package.json`
- **AND** that package manifest lists multiple child workflow manifests
- **THEN** the loader SHALL register one loaded workflow per listed child manifest
- **AND** each loaded workflow SHALL retain its own `workflowId`

#### Scenario: Legacy single-workflow directory remains valid

- **WHEN** a workflow directory contains a root `workflow.json`
- **THEN** the loader SHALL continue to load it as a single workflow

### Requirement: Builtin workflow packages SHALL preserve workflow-level UX identity

Bundling multiple workflows into one package SHALL NOT change workflow-level UI identity, settings identity, or user override identity.

#### Scenario: Settings and UI continue to address workflowId

- **WHEN** a bundled builtin workflow is shown in menus, dashboard, or settings
- **THEN** it SHALL still be addressed by its workflow `id`
- **AND** packaging metadata SHALL NOT become a new UI grouping requirement

#### Scenario: User override remains workflow-scoped

- **WHEN** a user workflow and a builtin packaged workflow share the same workflow `id`
- **THEN** the user workflow SHALL override only that workflow
- **AND** the rest of the builtin package SHALL remain available

