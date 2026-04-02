# workflow-execution-seams Specification

## Purpose
TBD - created by archiving change refactor-workflow-execution-seams. Update Purpose after archive.
## Requirements
### Requirement: Workflow execution orchestration SHALL expose explicit seam boundaries
The execution pipeline SHALL be organized into explicit seams for preparation, run coordination, result application, and feedback reporting.

#### Scenario: Preparation seam is independently invocable
- **WHEN** workflow execution starts
- **THEN** selection validation and request preparation are executed through a dedicated preparation seam contract

#### Scenario: Apply seam is isolated from queue orchestration
- **WHEN** provider run results are available
- **THEN** result application is executed through a dedicated apply seam contract rather than inline queue logic

### Requirement: Seam refactor SHALL preserve observable behavior
Refactoring into seams SHALL preserve current observable behavior of execution outcomes and user-facing summaries.

#### Scenario: No-valid-input behavior parity
- **WHEN** filtered inputs produce zero executable units
- **THEN** skipped semantics and finish messaging remain equivalent to current behavior

#### Scenario: Mixed job outcomes behavior parity
- **WHEN** a trigger includes succeeded and failed jobs
- **THEN** succeeded/failed/skipped counts and failure reason aggregation remain equivalent to current behavior

### Requirement: Seam handoff SHALL use explicit contracts
Data transfer between seams SHALL use explicit typed handoff contracts, not hidden mutation across mixed stages.

#### Scenario: Run seam consumes preparation output
- **WHEN** queue execution begins
- **THEN** run seam receives explicit handoff data (requests, stats, execution context) from preparation seam

#### Scenario: Feedback seam consumes per-job outcomes
- **WHEN** execution completes
- **THEN** feedback seam receives explicit outcome summaries to render final reporting

### Requirement: Backend-backed workflow batches SHALL dispatch fully in parallel
The execution seam SHALL remove frontend concurrency throttling for
backend-backed workflow providers while preserving local queue orchestration.

#### Scenario: SkillRunner batch uses full-parallel dispatch
- **WHEN** the execution seam runs a batch for provider `skillrunner`
- **THEN** queue concurrency equals the batch request count
- **AND** the frontend SHALL NOT impose an extra fixed concurrency cap

#### Scenario: Generic HTTP batch uses full-parallel dispatch
- **WHEN** the execution seam runs a batch for provider `generic-http`
- **THEN** queue concurrency equals the batch request count
- **AND** backend-side capacity control remains authoritative

#### Scenario: Pass-through batch keeps serialized execution
- **WHEN** the execution seam runs a batch for provider `pass-through`
- **THEN** queue concurrency remains `1`
- **AND** pass-through local execution semantics remain unchanged

### Requirement: Local queue lifecycle SHALL remain the frontend execution model
Removing frontend throttling MUST NOT remove the local queue or its lifecycle
contracts.

#### Scenario: Batch completion still converges through queue idle
- **WHEN** a workflow batch is dispatched with full backend-backed concurrency
- **THEN** the seam MUST still wait for queue idle before result-apply and final summary aggregation

#### Scenario: Pass-through keeps serialized execution semantics
- **WHEN** the execution seam runs a batch for provider `pass-through`
- **THEN** frontend dispatch MUST remain serialized
- **AND** this change MUST NOT alter pass-through local execution semantics

### Requirement: Seam boundaries SHALL support deterministic testing
Each seam SHALL be testable through dependency injection of side-effectful collaborators.

#### Scenario: Preparation seam test without provider execution
- **WHEN** seam-level tests run
- **THEN** preparation seam can be tested without invoking provider or applyResult side effects

#### Scenario: Feedback seam test without UI runtime
- **WHEN** feedback seam tests run in mock environment
- **THEN** message generation and toast-trigger decisions can be asserted via injected adapters

### Requirement: Configurable workflow trigger failures SHALL be observable
Configurable workflows that require a settings gate MUST NOT silently no-op
when the gate fails before execution starts.

#### Scenario: Settings gate creation fails
- **WHEN** a configurable workflow trigger reaches settings-gate dialog opening
- **AND** dialog initialization fails
- **THEN** the system SHALL emit a trigger failure runtime log
- **AND** the user SHALL receive explicit failure feedback
- **AND** the workflow SHALL NOT silently disappear

### Requirement: Workflow source SHALL be included in trigger diagnostics
Trigger diagnostics MUST identify whether the loaded workflow came from the
builtin registry or a user override.

#### Scenario: Builtin workflow is shadowed by user workflow
- **WHEN** a workflow trigger fails for a workflow ID that exists in both builtin and user directories
- **THEN** runtime diagnostics SHALL include the currently loaded workflow source
- **AND** operators SHALL be able to distinguish builtin regression from user override behavior

### Requirement: Tag Manager SHALL support configurable GitHub vocabulary sync
The `tag-manager` workflow SHALL support persisted workflow parameters for
GitHub-backed controlled vocabulary subscribe/publish.

#### Scenario: Tag Manager opens with complete GitHub sync config
- **WHEN** the user opens workflow `tag-manager`
- **AND** `github_owner`, `github_repo`, `file_path`, and `github_token` are configured
- **THEN** the workflow SHALL attempt to subscribe remote `tags/tags.json` before the editor opens
- **AND** successful remote tags SHALL seed the editor initial entries

#### Scenario: GitHub config is incomplete
- **WHEN** the user opens workflow `tag-manager`
- **AND** the GitHub sync config is incomplete
- **THEN** the workflow SHALL continue in local-only mode
- **AND** it SHALL NOT block the editor

### Requirement: Tag Manager SHALL distinguish local and subscription committed vocab sources
`tag-manager` SHALL resolve its committed controlled vocabulary from different
sources depending on whether GitHub sync is configured.

#### Scenario: Local mode reads local committed vocabulary
- **WHEN** GitHub sync config is incomplete
- **THEN** Tag Manager SHALL use local committed vocabulary as controlled vocab truth

#### Scenario: Subscription mode reads remote committed snapshot
- **WHEN** GitHub sync config is complete
- **THEN** Tag Manager SHALL use the remote committed snapshot as controlled vocab truth
- **AND** staged or pending entries SHALL NOT appear in committed controlled vocab

### Requirement: Tag Manager staged promotion SHALL be transactional in subscription mode
Staged entries promoted while GitHub sync is configured SHALL be published in a
debounced transaction before becoming committed controlled vocabulary.

#### Scenario: Subscription-mode staged batch succeeds
- **WHEN** one or more staged entries are promoted within the debounce window
- **THEN** Tag Manager SHALL issue one publish transaction for the batch
- **AND** only after publish succeeds SHALL those entries be removed from staged
- **AND** the committed controlled vocab SHALL refresh to include them

#### Scenario: Subscription-mode staged batch fails
- **WHEN** a staged promotion batch publish fails
- **THEN** Tag Manager SHALL keep the batch entries in staged
- **AND** the committed controlled vocab SHALL remain unchanged
- **AND** the user SHALL receive explicit failure feedback

### Requirement: Tag Manager save SHALL commit remotely before updating subscription-mode controlled vocab
Saving edited controlled vocabulary in subscription mode SHALL update committed
state only after the remote transaction succeeds.

#### Scenario: Subscription-mode save publish fails
- **WHEN** the user saves edited controlled vocabulary while GitHub sync is configured
- **AND** the remote publish fails
- **THEN** the remote committed snapshot SHALL remain unchanged
- **AND** the editor session SHALL preserve the failed draft with explicit retry feedback

#### Scenario: GitHub Contents API conflict happens once
- **WHEN** a publish attempt receives `409 Conflict`
- **THEN** the workflow SHALL re-fetch the latest remote contents
- **AND** retry publish once using the latest remote metadata plus current local tags

### Requirement: Active committed vocabulary SHALL back runtime consumers
Runtime consumers of controlled vocabulary SHALL resolve the active committed
vocabulary for the current mode rather than reading staged or pending data.

#### Scenario: Tag Regulator builds requests in subscription mode
- **WHEN** Tag Regulator builds `valid_tags` while GitHub sync is configured
- **THEN** it SHALL read the remote committed snapshot
- **AND** it SHALL NOT include staged or pending entries

### Requirement: Suggest and staged tag UIs SHALL expose parent binding counts
Workflow UIs that surface staged or stage-backed suggested tags SHALL display
the current number of bound parent items.

#### Scenario: Tag Manager staged inbox shows parent binding count
- **WHEN** a staged entry carries `parentBindings`
- **THEN** the staged inbox SHALL display the current binding count for that row

#### Scenario: Tag-Regulator suggest dialog shows staged-hit binding count
- **WHEN** a returned suggest tag already exists in staged storage
- **THEN** the suggest dialog SHALL still display that tag
- **AND** it SHALL display the merged parent binding count for that row

### Requirement: The system SHALL merge current parent bindings before the suggest dialog opens
When a returned suggest tag already exists in staged storage, the system SHALL
merge the current parent item into that staged record before the suggest dialog opens.

#### Scenario: Returned staged-hit suggest tag merges current parent
- **WHEN** `tag-regulator` receives a suggest tag that is already present in staged storage
- **THEN** the current parent item ID SHALL be merged into that staged record's `parentBindings`
- **AND** the dialog SHALL render using the merged binding count

### Requirement: Builtin workflow hooks remain pluggable and self-contained
Builtin workflow code under `workflows_builtin/**` MUST remain self-contained.
It MAY depend on plugin-core generic host/runtime capabilities, but it MUST NOT
depend on sibling builtin workflow code or workflow-side shared business modules.

#### Scenario: Builtin workflow uses host runtime capability
- **GIVEN** a builtin workflow needs toast or runtime-log output
- **WHEN** it uses plugin-core workflow runtime host capabilities
- **THEN** the capability is limited to generic host behavior
- **AND** no tag-vocabulary business semantics are exposed by plugin core

#### Scenario: Builtin workflow avoids sibling workflow imports
- **GIVEN** a builtin workflow hook file
- **WHEN** it is loaded from `workflows_builtin/**`
- **THEN** it MUST NOT import another builtin workflow directory or `workflows_builtin/shared/*`

### Requirement: Builtin workflow loading remains compatible with fallback loading
Builtin workflow hooks MUST remain loadable through the current workflow loader
fallback path.

#### Scenario: Builtin tag workflows are discovered after boundary repair
- **GIVEN** the builtin workflow directory contains `tag-manager` and `tag-regulator`
- **WHEN** workflow manifests are loaded
- **THEN** both workflows remain discoverable and executable
- **AND** the loading path is not blocked by removed cross-file hook imports

### Requirement: Tag-Regulator Suggest Intake Must Respect Subscription Publish Transactions
`tag-regulator` suggest intake SHALL use the active tag vocabulary mode to decide whether a selected suggest tag is committed locally or published remotely.

#### Scenario: Subscription-mode join publish fails
- **WHEN** a user joins a suggest tag from the `tag-regulator` suggest dialog while Tag Manager is in subscription mode
- **AND** the remote vocabulary publish fails
- **THEN** the tag SHALL be written to staged storage with tag-regulator parent bindings
- **AND** the user SHALL receive a short publish failure toast
- **AND** the failure SHALL be logged

### Requirement: Staged Suggest Tags Must Retain Parent Bindings
Staged entries created from `tag-regulator` suggestions SHALL retain the set of parent items that proposed the tag.

#### Scenario: Same staged tag is suggested by multiple parents
- **WHEN** two or more `tag-regulator` runs stage the same suggest tag for different parent items
- **THEN** the staged entry SHALL retain the union of those parent item IDs

#### Scenario: Staged intake remains deferred
- **WHEN** a `tag-regulator` suggest tag is written to staged storage
- **THEN** the staged entry SHALL retain deferred parent bindings
- **AND** the workflow SHALL NOT append that tag to any parent item until committed vocabulary update succeeds

### Requirement: Successful Staged Publish Must Backfill Bound Parent Tags
When a staged tag with parent bindings successfully enters committed vocabulary, that tag SHALL be appended to every bound parent item.

#### Scenario: Tag Manager promotes staged tag with parent bindings
- **WHEN** Tag Manager successfully publishes a staged tag that carries tag-regulator parent bindings
- **THEN** the tag SHALL be appended to each bound parent item
- **AND** the staged entry SHALL be removed after the bindings are applied
