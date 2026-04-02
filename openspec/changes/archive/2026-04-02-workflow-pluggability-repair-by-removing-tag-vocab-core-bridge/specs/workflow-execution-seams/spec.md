## MODIFIED Requirements

### Requirement: Builtin workflow hooks remain pluggable and self-contained

Builtin workflow code under `workflows_builtin/**` MUST remain self-contained. It MAY depend on plugin-core generic host/runtime capabilities, but it MUST NOT depend on sibling builtin workflow code or workflow-side shared business modules.

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

Builtin workflow hooks MUST remain loadable through the current workflow loader fallback path.

#### Scenario: Builtin tag workflows are discovered after boundary repair

- **GIVEN** the builtin workflow directory contains `tag-manager` and `tag-regulator`
- **WHEN** workflow manifests are loaded
- **THEN** both workflows remain discoverable and executable
- **AND** the loading path is not blocked by removed cross-file hook imports
