# workflow-business-decoupling-boundary Specification

## Purpose
TBD - created by archiving change enforce-workflow-business-logic-decoupling. Update Purpose after archive.

## Requirements

### Requirement: Core modules SHALL remain workflow-business-agnostic
Plugin core modules under `src/**` SHALL NOT encode business semantics for any concrete workflow.

#### Scenario: Core code review for workflow-specific branching
- **WHEN** core modules are reviewed
- **THEN** no branch/normalization path is keyed by concrete workflow identity for business behavior

#### Scenario: Workflow-specific field semantics location
- **WHEN** a workflow requires custom field fallback/normalization
- **THEN** that behavior is implemented in workflow-owned extension logic, not hardcoded in core modules

### Requirement: Protocol-level concerns MAY stay in core
Core modules under `src/**` MAY implement shared protocol/runtime concerns that are workflow-agnostic.

#### Scenario: Request kind and provider orchestration
- **WHEN** execution context is prepared
- **THEN** core modules may resolve request kind/provider/backend/profile using shared generic rules

#### Scenario: Generic schema normalization
- **WHEN** workflow parameters are schema-normalized
- **THEN** core applies schema-driven generic normalization without embedding concrete workflow business semantics

### Requirement: Workflow settings normalization extension seam SHALL exist
The architecture SHALL provide an extension seam for workflow-specific settings normalization/validation.

#### Scenario: Workflow registers custom settings normalizer
- **WHEN** a workflow exposes settings-specific normalization logic
- **THEN** core discovers and invokes it through the extension seam contract

#### Scenario: Workflow has no custom normalizer
- **WHEN** no workflow-specific extension is provided
- **THEN** core proceeds with generic normalization and default handling

### Requirement: Boundary enforcement SHALL be regression-tested
The codebase SHALL include tests and review checks preventing workflow-business coupling from returning to core modules.

#### Scenario: Regression test detects core coupling
- **WHEN** workflow-specific business branching is introduced into core normalization paths
- **THEN** automated tests fail

#### Scenario: Architecture review checklist
- **WHEN** a change touches `src/**` settings/runtime code
- **THEN** review confirms boundary policy compliance before merge
