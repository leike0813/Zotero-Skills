## ADDED Requirements

### Requirement: Workflow package internal sharing

Builtin workflow packages SHALL be allowed to expose package-local implementation modules under `lib/` for use by workflows declared inside the same package.

#### Scenario: same-package lib reuse

- **WHEN** two workflows are declared from the same `workflow-package.json`
- **THEN** their hooks MAY import modules from that package's `lib/` directory
- **AND** this does not change workflow registration identity, which remains keyed by `workflowId`

### Requirement: Workflow package refactors are behavior-preserving

Refactoring builtin workflow-package internals into package-local shared modules MUST NOT change workflow manifests, settings keys, or user-facing behavior.

#### Scenario: package-local refactor keeps external contract stable

- **WHEN** builtin workflows are reorganized to use package-local `lib/` modules
- **THEN** their `workflowId`, manifest shape, settings persistence, and UI entry points remain unchanged
