## ADDED Requirements

### Requirement: Formal broker-backed Zotero MCP tool registry

The system SHALL expose Zotero MCP tools from a registry that defines tool metadata, input schema, and handler behavior.

#### Scenario: Tool listing includes formal tool suite

- **WHEN** an MCP client calls `tools/list`
- **THEN** the server SHALL return the formal Zotero read and mutation tools with JSON schemas
- **AND** tool definitions SHALL be generated from the registry rather than hard-coded per response.

#### Scenario: Unknown tool is rejected

- **WHEN** an MCP client calls an unknown Zotero tool
- **THEN** the server SHALL return a JSON-RPC invalid params error
- **AND** no broker read or write call SHALL be executed.

### Requirement: JSON-safe read MCP tools

The system SHALL expose read-only Zotero MCP tools through `hostApi.context` and `hostApi.library`.

#### Scenario: Current view and selected items

- **WHEN** an MCP client calls `zotero.get_current_view` or `zotero.get_selected_items`
- **THEN** the tool SHALL return JSON-safe broker DTOs
- **AND** raw Zotero objects SHALL NOT be returned.

#### Scenario: Library query tools

- **WHEN** an MCP client calls `zotero.search_items`, `zotero.get_item_detail`, `zotero.get_item_notes`, or `zotero.get_item_attachments`
- **THEN** the tool SHALL call the corresponding `hostApi.library` API
- **AND** the result SHALL include compact text content and structured JSON content.

### Requirement: Attachment access DTO

The system SHALL return attachment access metadata without embedding file contents in MCP JSON.

#### Scenario: Local file attachment

- **WHEN** `zotero.get_item_attachments` returns a file attachment with a local path
- **THEN** the MCP result SHALL include `access.mode = "local-path"` and `access.path`
- **AND** the MCP result SHALL NOT include the file content.

#### Scenario: Remote-compatible attachment contract

- **WHEN** an attachment is returned
- **THEN** the MCP result SHALL include a stable `access` object that can later represent `download-url`
- **AND** clients SHALL NOT need a schema change when remote attachment URLs are added.

### Requirement: Permission-gated mutation MCP tools

The system SHALL expose limited Zotero writes through broker mutation preview and permission-gated execute.

#### Scenario: Preview mutation

- **WHEN** an MCP client calls `zotero.preview_mutation`
- **THEN** the server SHALL call `hostApi.mutations.preview()`
- **AND** Zotero data SHALL NOT be changed.

#### Scenario: Approved write tool

- **WHEN** an MCP client calls a supported write tool and the user approves the permission request
- **THEN** the server SHALL call `hostApi.mutations.execute()`
- **AND** return a JSON-safe execution result.

#### Scenario: Denied or unavailable permission

- **WHEN** permission is denied or no permission hook is available
- **THEN** the server SHALL return a structured non-executed result
- **AND** Zotero data SHALL NOT be changed.
