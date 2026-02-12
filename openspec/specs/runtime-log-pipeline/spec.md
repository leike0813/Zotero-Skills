# runtime-log-pipeline Specification

## Purpose
TBD - created by archiving change add-plugin-log-system. Update Purpose after archive.
## Requirements
### Requirement: Runtime Log Pipeline SHALL Record Structured Entries In Memory
The system SHALL provide a centralized in-memory pipeline that records plugin runtime logs as structured entries.

#### Scenario: Append a normal workflow entry
- **WHEN** a workflow lifecycle event is emitted
- **THEN** the pipeline SHALL append one entry containing timestamp, level, scope, stage, and message fields

#### Scenario: Append an error entry
- **WHEN** an exception is captured during workflow execution
- **THEN** the pipeline SHALL append an error entry with normalized error object including name, message, and stack when available

### Requirement: Runtime Log Pipeline SHALL Instrument Trigger-Level and Job-Level Execution Boundaries
The system MUST record key execution boundaries to support failure diagnosis without reading raw console logs.

#### Scenario: Workflow trigger lifecycle logging
- **WHEN** a workflow trigger starts and ends
- **THEN** the pipeline SHALL record start and finish entries with workflow context metadata

#### Scenario: Per-job lifecycle logging
- **WHEN** each job transitions through build/dispatch/poll/apply boundaries
- **THEN** the pipeline SHALL record entries that can be correlated by requestId or job identifier

### Requirement: Runtime Log Pipeline SHALL Default to Recording info/warn/error and Not Record debug by Default
The default runtime write policy SHALL record `info`, `warn`, and `error` levels while excluding `debug` unless explicitly enabled in future extension.

#### Scenario: Debug entry under default policy
- **WHEN** a debug-level write is attempted under default settings
- **THEN** the pipeline SHALL ignore it and keep stored entries unchanged

#### Scenario: Error entry under default policy
- **WHEN** an error-level write is attempted under default settings
- **THEN** the pipeline SHALL store the entry successfully

### Requirement: Runtime Log Pipeline SHALL Redact Sensitive Auth Data Before Storage
The system MUST prevent known secret-bearing fields from being persisted in runtime logs.

#### Scenario: Authorization header present in details
- **WHEN** a log entry includes auth header/token fields in details
- **THEN** the stored entry SHALL replace sensitive values with redacted placeholders

