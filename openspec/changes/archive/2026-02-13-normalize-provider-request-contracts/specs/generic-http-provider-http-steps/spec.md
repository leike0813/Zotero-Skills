## MODIFIED Requirements

### Requirement: Generic HTTP Provider SHALL Support Multi-step Request Kind
The system SHALL support `generic-http.steps.v1` as a provider-executable request kind under `generic-http` backend type.

#### Scenario: Resolve provider for steps request
- **WHEN** a workflow emits `requestKind=generic-http.steps.v1` with backend type `generic-http`
- **THEN** provider registry SHALL resolve execution to `GenericHttpProvider`

### Requirement: Generic HTTP Provider SHALL Preserve Existing Single-request Behavior
The addition of `generic-http.steps.v1` SHALL NOT break existing `generic-http.request.v1` workflows.

#### Scenario: Legacy single request still works
- **WHEN** workflow emits `generic-http.request.v1`
- **THEN** provider SHALL execute existing single-request behavior unchanged

### Requirement: Generic HTTP Request Kinds SHALL Share Normalized Contract Validation
Both `generic-http.request.v1` and `generic-http.steps.v1` SHALL be validated through the shared provider-request contract layer before provider execution.

#### Scenario: Invalid steps payload fails with normalized contract error
- **WHEN** `generic-http.steps.v1` payload misses required contract fields (e.g. empty `steps[]`)
- **THEN** execution SHALL fail before provider network dispatch
- **AND** failure SHALL expose normalized contract category/reason

#### Scenario: Invalid single-request payload fails with normalized contract error
- **WHEN** `generic-http.request.v1` payload misses required contract fields (e.g. missing method/path)
- **THEN** execution SHALL fail with the same normalized contract semantics used by steps kind
