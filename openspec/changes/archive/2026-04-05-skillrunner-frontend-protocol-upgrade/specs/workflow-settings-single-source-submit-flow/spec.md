## MODIFIED Requirements

### Requirement: SkillRunner runtime options SHALL be mode-gated
For SkillRunner workflows, UI exposure and request payload MUST follow `execution.skillrunner_mode`.

#### Scenario: Provider-aware engine submit snapshot uses explicit provider_id
- **WHEN** a SkillRunner workflow resolves execution context for a provider-aware engine
- **THEN** the resolved submit snapshot SHALL carry explicit `provider_id`
- **AND** `/v1/jobs` create payload SHALL submit `engine + provider_id + model + effort`
- **AND** frontend SHALL NOT require `provider/model` string as canonical request value

#### Scenario: Effort stays visible and model-scoped in settings UI
- **WHEN** the SkillRunner settings UI renders provider runtime options
- **THEN** it SHALL render `engine -> provider_id -> model -> effort` in that dependency order
- **AND** `effort` SHALL remain visible even when the selected model does not support custom effort
- **AND** unsupported-effort models SHALL expose only `default` and disable the effort selector

#### Scenario: Legacy persisted provider/model values are upgraded on write
- **WHEN** persisted settings still use legacy `model_provider`, `model="provider/model"`, `model="provider/model@effort"`, or `model="model@effort"`
- **THEN** frontend MAY read them for compatibility
- **AND** any subsequent settings save or submit-confirm writeback SHALL persist explicit `provider_id + model + effort`

#### Scenario: Provider-aware engine blocks empty provider selection
- **WHEN** a provider-aware engine is selected and `provider_id` is empty
- **THEN** model choices SHALL remain unavailable or invalid
- **AND** the frontend SHALL NOT form a valid SkillRunner submit payload

#### Scenario: Single-provider engines hide provider but still normalize canonical provider_id
- **WHEN** a single-provider engine such as `codex`, `gemini`, or `iflow` is selected
- **THEN** the settings UI SHALL hide the provider selector
- **AND** the resolved execution context SHALL still carry the engine's canonical `provider_id`
