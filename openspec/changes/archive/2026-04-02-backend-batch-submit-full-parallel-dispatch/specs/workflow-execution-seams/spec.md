## ADDED Requirements

### Requirement: Backend-backed workflow batches SHALL dispatch fully in parallel

The execution seam MUST NOT impose frontend concurrency throttling on
backend-backed workflow batches.

#### Scenario: SkillRunner batch uses full-parallel dispatch

- **WHEN** the execution seam runs a batch for provider `skillrunner`
- **THEN** queue dispatch concurrency MUST equal the batch request count
- **AND** frontend MUST NOT apply an additional fixed concurrency cap

#### Scenario: Generic HTTP batch uses full-parallel dispatch

- **WHEN** the execution seam runs a batch for provider `generic-http`
- **THEN** queue dispatch concurrency MUST equal the batch request count
- **AND** backend-side capacity control SHALL remain authoritative

### Requirement: Local queue lifecycle SHALL remain the frontend execution model

Removing frontend throttling MUST NOT remove the local queue or its lifecycle
contracts.

#### Scenario: Batch completion still converges through queue idle

- **WHEN** a workflow batch is dispatched with full backend-backed concurrency
- **THEN** the seam MUST still wait for queue idle before result-apply and final
  summary aggregation

#### Scenario: Pass-through keeps serialized execution

- **WHEN** the execution seam runs a batch for provider `pass-through`
- **THEN** frontend dispatch MUST remain serialized
- **AND** this change MUST NOT alter pass-through local execution semantics
