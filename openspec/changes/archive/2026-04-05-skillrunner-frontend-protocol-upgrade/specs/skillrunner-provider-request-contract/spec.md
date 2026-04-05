## ADDED Requirements

### Requirement: SkillRunner provider-aware engine requests SHALL use explicit provider_id
The frontend SkillRunner provider contract MUST treat `provider_id` as the canonical provider selector for provider-aware engines.

#### Scenario: Provider-aware engine request create payload
- **WHEN** the frontend submits a SkillRunner run for a provider-aware engine
- **THEN** the create payload SHALL include `engine`, `provider_id`, `model`, and `effort`
- **AND** `provider/model` SHALL NOT be the canonical frontend request representation

#### Scenario: Legacy provider/model string remains read-compatible only
- **WHEN** the frontend encounters legacy persisted config using `model="provider/model"`, `model="provider/model@effort"`, or `model="model@effort"`
- **THEN** it MAY parse that value for compatibility
- **AND** it SHALL normalize execution to explicit `provider_id + model + effort`
- **AND** any rewritten config SHALL stop using the legacy combined string

#### Scenario: Model catalog prefers explicit provider and model metadata
- **WHEN** model catalog entries include explicit provider/model fields
- **THEN** frontend normalization SHALL prefer those explicit fields
- **AND** legacy `id` splitting MAY be used only as compatibility fallback

#### Scenario: Model catalog exposes supported_effort as first-class metadata
- **WHEN** the frontend loads SkillRunner model catalog data from bundled snapshots or backend cache
- **THEN** it SHALL preserve `supported_effort`
- **AND** the settings UI SHALL derive effort options from that metadata rather than embedding model-specific effort lists in UI code

#### Scenario: Provider-scoped engines are detected from catalog metadata
- **WHEN** a SkillRunner engine exposes stable `provider_id/provider + model` metadata in the model catalog
- **THEN** frontend SHALL treat that engine as provider-aware for settings, enum filtering, and submit normalization
- **AND** frontend SHALL NOT hardcode `opencode` as the only provider-scoped engine

#### Scenario: Single-provider engines normalize provider_id internally
- **WHEN** the selected SkillRunner engine is a single-provider engine
- **THEN** the frontend MAY hide provider selection from the user
- **AND** it SHALL still normalize request execution to the engine's canonical `provider_id`
