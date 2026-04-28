# zotero-mcp-tools-stability Specification

## Purpose
TBD - created by archiving change stabilize-zotero-mcp-tools-streamable-http. Update Purpose after archive.
## Requirements
### Requirement: Streamable HTTP-only Zotero MCP transport

The embedded Zotero MCP server SHALL support only stateless Streamable HTTP for MCP client communication.

#### Scenario: POST MCP request returns JSON-RPC response

- **WHEN** an authorized client sends a JSON-RPC request to `POST /mcp`
- **THEN** the server SHALL return `200 application/json`
- **AND** the response body SHALL contain the JSON-RPC response.

#### Scenario: MCP notification returns accepted empty response

- **WHEN** an authorized client sends a JSON-RPC notification to `POST /mcp`
- **THEN** the server SHALL return `202 Accepted`
- **AND** the response body SHALL be empty.

#### Scenario: Legacy SSE endpoints are not supported

- **WHEN** an authorized client sends `GET /mcp`
- **THEN** the server SHALL return `405 Method Not Allowed`
- **AND** diagnostics SHALL record `streamable_http_get_not_supported`.

- **WHEN** a client sends a request to `/mcp/message`
- **THEN** the server SHALL return `404 not_found`.

### Requirement: HTTP-only ACP MCP descriptor injection

ACP integration SHALL inject the embedded Zotero MCP server only as an HTTP MCP descriptor.

#### Scenario: Backend supports HTTP MCP

- **WHEN** an ACP backend advertises HTTP MCP support
- **THEN** `mcpServers` SHALL contain the Zotero descriptor with `type = "http"`.

#### Scenario: Backend supports only SSE MCP

- **WHEN** an ACP backend does not advertise HTTP MCP support
- **THEN** Zotero MCP SHALL NOT be injected
- **AND** diagnostics SHALL record `zotero_mcp_unavailable`.

### Requirement: Serialized and diagnosable tool execution

The MCP server SHALL execute Zotero `tools/call` requests serially and record safe diagnostics.

#### Scenario: Concurrent tool calls

- **WHEN** two `tools/call` requests arrive concurrently
- **THEN** both calls SHALL receive JSON-RPC responses
- **AND** diagnostics SHALL include queue wait and duration data.

#### Scenario: Tool handler failure

- **WHEN** a tool handler throws
- **THEN** the server SHALL return a JSON-RPC error or structured tool error
- **AND** the HTTP connection SHALL NOT fail without a response.

### Requirement: Agent-readable Zotero tool contracts

The Zotero MCP tool registry SHALL expose clear schemas and descriptions for supported tool arguments.

#### Scenario: Tool list documents recommended arguments

- **WHEN** an MCP client calls `tools/list`
- **THEN** each Zotero tool SHALL include an input schema with clear descriptions for refs, required fields, and write permission behavior.

#### Scenario: Invalid arguments

- **WHEN** an MCP client supplies invalid refs, empty fields, empty tags, or empty content
- **THEN** the tool SHALL return a structured parameter error
- **AND** no write SHALL occur.

### Requirement: Broker read-tool hardening

The broker-backed read tools SHALL avoid transport failure from child-level Zotero API errors.

#### Scenario: Attachment path failure

- **WHEN** an attachment path cannot be read
- **THEN** `zotero.get_item_attachments` SHALL still return available attachment DTOs
- **AND** include warnings or errors for failed child data.

#### Scenario: Note serialization failure

- **WHEN** one child note cannot be serialized
- **THEN** `zotero.get_item_notes` SHALL return remaining notes
- **AND** include warnings or errors for the failed note.

