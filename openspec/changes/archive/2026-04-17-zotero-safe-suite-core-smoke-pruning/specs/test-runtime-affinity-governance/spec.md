## MODIFIED Requirements

### Requirement: Zotero-safe regressions MUST avoid real interactive UI

Regular Zotero-safe regression runs MUST NOT open real editor, file picker, or
dialog UI.

#### Scenario: Routine Zotero suite excludes non-host-smoke classes

- **WHEN** a test is package-helper, schema-only, payload-shape, mock-heavy,
  seam-heavy, fake-DOM, GitHub-sync, local-runtime, installer, or other deep
  environment coverage
- **THEN** it MUST NOT remain in the routine Zotero suite
- **AND** it is instead covered by Node or `full`-only execution

#### Scenario: Routine Zotero suite retains only documented allowlist files

- **WHEN** a real Zotero routine run selects a first-level domain
- **THEN** only the documented allowlist of retained smoke files for that
  domain is executed
- **AND** non-allowlisted files are skipped without changing Node coverage
