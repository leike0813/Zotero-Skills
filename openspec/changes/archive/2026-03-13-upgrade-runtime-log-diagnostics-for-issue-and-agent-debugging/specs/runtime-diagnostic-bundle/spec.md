## ADDED Requirements

### Requirement: Diagnostic Bundle Export SHALL Follow RuntimeDiagnosticBundleV1 Schema
The system SHALL export diagnostics as a single JSON document `RuntimeDiagnosticBundleV1`.

#### Scenario: Export bundle baseline structure
- **WHEN** diagnostic bundle export is requested
- **THEN** the output JSON SHALL include `schemaVersion`, `meta`, `filters`, `timeline`, `incidents`, and `entries`
- **AND** `entries` SHALL preserve sanitized raw log rows for machine processing

### Requirement: Diagnostic Bundle Export SHALL Include Environment Fingerprint by Default
The bundle SHALL include non-sensitive environment fingerprint data for reproducibility.

#### Scenario: Build bundle meta section
- **WHEN** export runs under default settings
- **THEN** `meta` SHALL include plugin version, Zotero/runtime version, platform summary, locale, and export time window
- **AND** explicit credentials/secrets SHALL NOT appear in meta fields

### Requirement: Diagnostic Bundle Export SHALL Enforce Balanced Redaction
The export MUST apply balanced redaction and payload summarization rules.

#### Scenario: Sensitive field present in log details
- **WHEN** exported entries contain secret-bearing keys or values
- **THEN** those values SHALL be redacted
- **AND** large text payloads SHALL be exported as truncated preview plus digest hash instead of full raw content

### Requirement: Diagnostic Bundle Export SHALL Provide Incident Aggregation
The export SHALL include aggregated incident chains to speed issue triage.

#### Scenario: Request has retries and terminal failure
- **WHEN** timeline includes retry and terminal events for the same request/job chain
- **THEN** `incidents` SHALL summarize first-failure point, retry trajectory, and terminal outcome with correlation IDs
