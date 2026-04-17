## MODIFIED Requirements

### Requirement: Zotero-safe regressions MUST avoid real interactive UI

Regular Zotero-safe regression runs MUST NOT open real editor, file picker, or
dialog UI.

#### Scenario: Thickened Zotero lite/full still exclude unstable UI-heavy classes

- **WHEN** a test depends on editor, picker, dialog, GitHub sync, mock-e2e,
  brittle multi-realm override, or other deep unstable host chains
- **THEN** it MUST NOT return to the routine Zotero `lite` or `full` suites
- **AND** it remains covered by Node or separate non-routine execution

#### Scenario: Full parity ring restores only documented host-safe additions

- **WHEN** Zotero `full` expands beyond the `lite` baseline
- **THEN** it restores only the documented host-safe parity cases
- **AND** it MUST NOT implicitly re-enable all tests from a retained mixed file
