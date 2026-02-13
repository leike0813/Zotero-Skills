## ADDED Requirements

### Requirement: Workflow settings dialog SHALL consume a dedicated render model

Workflow settings dialog UI rendering MUST be driven by an explicit render model, not by inline schema/data assembly in the dialog host.

#### Scenario: Dialog open initializes view model

- **WHEN** the workflow settings dialog is opened
- **THEN** section/field/action descriptors are produced by render-model builders
- **AND** dialog host renders from those descriptors without duplicating schema interpretation logic

### Requirement: Render-model composition SHALL be deterministic and side-effect free

Render-model builders MUST be pure and deterministic for the same manifest + settings inputs.

#### Scenario: Same inputs produce equivalent model

- **WHEN** the same workflow manifest and initial settings snapshots are provided
- **THEN** the produced render model is equivalent across runs
- **AND** no persistence/write side effects occur during composition

### Requirement: Draft serialization SHALL be centralized before domain apply/save

User-edited values in dialog controls MUST be collected and serialized through a single model-aware path before invoking settings domain APIs.

#### Scenario: Save and run-once apply

- **WHEN** user clicks save or apply in workflow settings dialog
- **THEN** dialog inputs are serialized through the centralized serializer
- **AND** settings domain receives structured payloads without duplicated dialog-layer normalization branches

### Requirement: Dialog refactor SHALL preserve behavior parity

The model/render split MUST NOT change existing workflow settings behavior.

#### Scenario: Existing settings interaction flow

- **WHEN** users perform open/edit/save/apply actions
- **THEN** run-once default reset, persistent save semantics, and execution settings behavior remain unchanged
- **AND** user-visible messaging and interaction flow stay equivalent
