## ADDED Requirements

### Requirement: JSON-safe broker read API

The system SHALL expose JSON-safe Zotero read/context capabilities through `hostApi.context` and `hostApi.library`.

#### Scenario: Current view DTO

- **WHEN** a workflow or MCP adapter calls `hostApi.context.getCurrentView()`
- **THEN** the result SHALL describe the current Zotero target, library, selection state, and current item metadata using JSON-safe values
- **AND** the result SHALL NOT contain raw `Zotero.Item` instances.

#### Scenario: Library item DTOs

- **WHEN** a caller uses `hostApi.library.searchItems()`, `getItemDetail()`, `getItemNotes()`, or `getItemAttachments()`
- **THEN** the returned values SHALL be bounded DTOs suitable for JSON serialization
- **AND** raw Zotero objects SHALL NOT be returned.

### Requirement: Controlled mutation command API

The system SHALL expose limited Zotero write operations through `hostApi.mutations.preview()` and `hostApi.mutations.execute()`.

#### Scenario: Preview validates without writing

- **WHEN** a supported mutation request is passed to `preview()`
- **THEN** the system SHALL validate references and inputs, produce a summary, and mark `requiresConfirmation` as true
- **AND** Zotero data SHALL NOT be changed.

#### Scenario: Execute delegates to handlers

- **WHEN** a supported mutation request is passed to `execute()` after caller-side permission confirmation
- **THEN** the system SHALL reuse existing handler primitives for the write
- **AND** the result SHALL return JSON-safe changed-object summaries.

#### Scenario: Unsupported or invalid mutation

- **WHEN** a mutation has an unsupported operation, invalid reference, invalid field, empty payload, or oversized input
- **THEN** the system SHALL reject it with a structured JSON-safe error
- **AND** Zotero data SHALL NOT be changed.

### Requirement: Legacy compatibility

The system SHALL preserve existing workflow compatibility while adding the broker API.

#### Scenario: Legacy handlers remain available

- **WHEN** existing workflow code calls `runtime.handlers` or raw `hostApi.items.*`
- **THEN** behavior SHALL remain compatible with the pre-change implementation.

#### Scenario: MCP tools use broker boundary

- **WHEN** MCP tools need Zotero read or write capabilities
- **THEN** they SHALL use broker APIs and DTOs
- **AND** they SHALL NOT directly expose `handlers.*` as MCP tools.
