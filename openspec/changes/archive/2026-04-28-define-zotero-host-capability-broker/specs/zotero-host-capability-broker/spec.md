# Zotero Host Capability Broker

## ADDED Requirements

### Requirement: Handlers are internal mutation primitives

The system SHALL treat `handlers` as an internal library for common Zotero mutation operations, not as a complete facade over the Zotero native API.

#### Scenario: Handler scope is described

- **WHEN** developer documentation or future capability specs describe `handlers`
- **THEN** they MUST state that handlers cover a finite write-oriented DSL
- **AND** they MUST NOT imply that handlers cover all Zotero native API capabilities.

### Requirement: Host API is the broker SSOT

The system SHALL treat `hostApi` as the forward-facing Host Capability Broker for workflow package code and MCP tool backends.

#### Scenario: A new Zotero capability is added

- **WHEN** a future change adds a Zotero capability intended for workflow package or MCP use
- **THEN** the capability SHOULD be modeled through `hostApi` or a broker module owned by `hostApi`
- **AND** direct exposure of Zotero native objects SHOULD be avoided at external boundaries.

### Requirement: Handlers remain available for legacy workflow hooks

The system SHALL preserve `runtime.handlers` for legacy workflow hook compatibility.

#### Scenario: Existing workflow hook uses runtime handlers

- **WHEN** an existing workflow hook calls `runtime.handlers`
- **THEN** the runtime MUST continue to provide the handlers object
- **AND** this SSOT MUST NOT be interpreted as requiring handler removal or renaming.

### Requirement: New workflow package code prefers hostApi

The system SHALL document `runtime.hostApi` as the preferred entry point for new workflow package development.

#### Scenario: Developer chooses a host capability entry point

- **WHEN** new workflow package code needs host capabilities
- **THEN** documentation SHOULD direct authors toward `runtime.hostApi`
- **AND** direct use of `runtime.zotero` SHOULD NOT be required for package-host-api workflows.

### Requirement: MCP tools use JSON-safe broker adapters

The system SHALL expose Zotero MCP tools as JSON-safe adapters over broker capabilities rather than direct exports of `handlers` or Zotero native APIs.

#### Scenario: Agent calls a Zotero MCP tool

- **WHEN** an MCP client invokes a Zotero tool
- **THEN** the tool response MUST be serializable JSON-compatible data
- **AND** the response MUST NOT contain `Zotero.Item`, `Zotero.Collection`, window, `nsIFile`, or other host runtime objects
- **AND** the tool contract MUST be named around an agent task rather than an internal handler method.

### Requirement: MCP mutation tools are permission-gated

The system SHALL require an explicit permission policy before exposing Zotero mutations through MCP tools.

#### Scenario: Future MCP write tool is proposed

- **WHEN** a future change proposes a tool that creates, updates, deletes, tags, files, or moves Zotero data
- **THEN** the change MUST define whether the tool requires user confirmation, a configured allow policy, or another explicit permission gate
- **AND** the tool MUST NOT be silently writable by default.

### Requirement: First formal MCP tools are read-oriented

The system SHALL prioritize read/context MCP tools before write tools.

#### Scenario: Formal MCP tool set is expanded beyond the spike

- **WHEN** the first non-spike Zotero MCP tools are implemented
- **THEN** the recommended order SHOULD start with current view, selected items, item search, item detail, notes, and attachments
- **AND** write tools SHOULD be deferred until permission policy is specified.

### Requirement: Broker SSOT document stays synchronized

The system SHALL maintain `doc/components/zotero-host-capability-broker-ssot.md` as the human-facing SSOT for this model.

#### Scenario: Related public contract changes

- **WHEN** `WorkflowHostApi`, `handlers` public behavior, Zotero MCP tool contracts, or MCP mutation permission policy changes
- **THEN** the SSOT document MUST be updated in the same change.
