## MODIFIED Requirements

### Requirement: Execution settings resolution SHALL remain behavior-equivalent
Execution context consumed by workflow runtime MUST be resolved by merging persisted settings with an optional submit-time override.

#### Scenario: Submit override merged with persisted settings
- **WHEN** submit-time execution options override is provided for a workflow execution
- **THEN** produced execution settings SHALL merge override onto persisted values for `backendId`, `workflowParams`, and `providerOptions`
- **AND** persisted settings SHALL NOT be mutated unless explicitly saved

#### Scenario: Persisted-only resolution remains stable
- **WHEN** no submit-time override is provided
- **THEN** execution settings SHALL be resolved from persisted settings only
- **AND** existing normalization fallback behavior SHALL remain unchanged
