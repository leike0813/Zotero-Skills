# zotero-mcp-health-monitor Specification

## Purpose
TBD - created by archiving change define-zotero-mcp-health-monitor-ssot. Update Purpose after archive.
## Requirements
### Requirement: MCP health is derived host-side

The embedded Zotero MCP host SHALL expose a JSON-safe health snapshot that represents the semantic service state.

#### Scenario: Server is listening without client traffic

- **WHEN** the embedded MCP server is running
- **AND** no MCP initialize request has been observed
- **THEN** the health snapshot state SHALL be `listening`
- **AND** severity SHALL be `ok`.

#### Scenario: Client handshake has been observed

- **WHEN** the recent MCP request log contains `initialize`
- **THEN** the health snapshot state SHALL be `handshake_seen`
- **AND** the snapshot SHALL set `clientHandshakeSeen=true`.

#### Scenario: Client listed tools

- **WHEN** the recent MCP request log contains `tools/list`
- **THEN** the health snapshot state SHALL be `tools_seen`
- **AND** the snapshot SHALL set `toolsListSeen=true`.

#### Scenario: Tool call is active

- **WHEN** the MCP queue has a running item or guard state has an active tool
- **THEN** the health snapshot state SHALL be `active`
- **AND** severity SHALL be `active`.

#### Scenario: Server is degraded by recent failure

- **WHEN** the server is running but recent request diagnostics contain a tool or response error
- **THEN** the health snapshot state SHALL be `degraded`
- **AND** severity SHALL be `warning`
- **AND** the tooltip SHALL include a safe error summary.

#### Scenario: Descriptor is stale

- **WHEN** watchdog state marks the descriptor as stale
- **THEN** the health snapshot state SHALL be `descriptor_stale`
- **AND** the recommended action SHALL indicate that the ACP session should reconnect.

#### Scenario: Circuit breaker is open

- **WHEN** one or more tool circuit breakers are open
- **THEN** the health snapshot state SHALL be `circuit_open`
- **AND** the snapshot SHALL expose `openCircuitCount`.

#### Scenario: Server is unavailable

- **WHEN** there is no running MCP server and no current descriptor injection evidence
- **THEN** the health snapshot state SHALL be `unavailable`.

### Requirement: ACP snapshots include MCP health

ACP session and sidebar snapshots SHALL include the host-derived MCP health snapshot.

#### Scenario: Sidebar snapshot is built

- **WHEN** the ACP sidebar model builds a snapshot from an active session snapshot
- **THEN** it SHALL include `mcpHealth`
- **AND** it SHALL preserve `mcpServer` for detailed diagnostics.

### Requirement: ACP UI does not own MCP health inference

The ACP chat UI SHALL render MCP LED state from `snapshot.mcpHealth`.

#### Scenario: UI renders MCP monitor

- **WHEN** `snapshot.mcpHealth` is present
- **THEN** the UI SHALL use its `severity`, `summary`, and `tooltip`
- **AND** SHALL NOT infer primary MCP health by scanning raw recent requests or diagnostics.

#### Scenario: Older snapshot lacks health

- **WHEN** `snapshot.mcpHealth` is absent
- **THEN** the UI MAY use a minimal compatibility fallback
- **BUT** this fallback SHALL be clearly secondary to the host-side health contract.

