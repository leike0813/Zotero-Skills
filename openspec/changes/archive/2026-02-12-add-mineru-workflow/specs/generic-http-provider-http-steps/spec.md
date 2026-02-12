## ADDED Requirements

### Requirement: Generic HTTP Provider SHALL Support Multi-step Request Kind
The system SHALL support `generic-http.steps.v1` as a provider-executable request kind under `generic-http` backend type.

#### Scenario: Resolve provider for steps request
- **WHEN** a workflow emits `requestKind=generic-http.steps.v1` with backend type `generic-http`
- **THEN** provider registry SHALL resolve execution to `GenericHttpProvider`

### Requirement: Generic HTTP Provider SHALL Execute Step Pipeline Deterministically
The provider SHALL execute declared steps in order and expose extracted values for subsequent steps.

#### Scenario: Sequential step execution
- **WHEN** steps include multiple dependent HTTP actions
- **THEN** provider SHALL execute them in declaration order
- **THEN** later steps SHALL be able to consume extracted values from earlier step responses

#### Scenario: Poll step completion
- **WHEN** a step declares polling semantics with timeout and success/failure conditions
- **THEN** provider SHALL repeatedly request until success, failure, or timeout

### Requirement: Generic HTTP Provider SHALL Support Upload And Download Binary Steps
The provider SHALL support binary transport steps needed by MinerU pipeline.

#### Scenario: Upload from source attachment path
- **WHEN** an upload step references a local source file path
- **THEN** provider SHALL upload file bytes using the declared method and endpoint

#### Scenario: Download bundle bytes
- **WHEN** a download step targets a bundle URL
- **THEN** provider SHALL return bytes in `ProviderExecutionResult.bundleBytes`

### Requirement: Generic HTTP Provider SHALL Apply Backend Auth And Default Headers
The provider SHALL merge backend-level auth/default headers with step/request headers.

#### Scenario: Bearer auth propagation
- **WHEN** backend auth is `bearer`
- **THEN** provider SHALL include `Authorization: Bearer <token>` for MinerU API requests unless explicitly overridden

#### Scenario: Header override precedence
- **WHEN** the same header key exists in backend defaults and step headers
- **THEN** step-level header value SHALL take precedence

### Requirement: Generic HTTP Provider SHALL Preserve Existing Single-request Behavior
The addition of `generic-http.steps.v1` SHALL NOT break existing `generic-http.request.v1` workflows.

#### Scenario: Legacy single request still works
- **WHEN** workflow emits `generic-http.request.v1`
- **THEN** provider SHALL execute existing single-request behavior unchanged
