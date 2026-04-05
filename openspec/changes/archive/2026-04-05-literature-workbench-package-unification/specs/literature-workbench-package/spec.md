## ADDED Requirements

### Requirement: literature-workbench-package SHALL unify builtin literature workflows under one package

The builtin package `literature-workbench-package` MUST provide the stable
package home for literature note generation, import/export, and explainer note
creation workflows.

#### Scenario: package registration after rename

- **WHEN** builtin workflows are scanned
- **THEN** the package id SHALL be `literature-workbench-package`
- **AND** `reference-workbench-package` SHALL NOT remain exposed as an active builtin package id

#### Scenario: workflow identity remains stable across package rename

- **WHEN** the package is loaded
- **THEN** workflow ids such as `literature-digest`, `literature-explainer`, `export-notes`, `import-notes`, `reference-matching`, and `reference-note-editor` SHALL remain unchanged

### Requirement: literature-workbench-package SHALL provide a unified note and artifact codec

The package MUST implement a shared codec layer for note content, payload
blocks, and artifact export/import semantics.

#### Scenario: digest artifact round-trip stays stable

- **WHEN** a literature-digest artifact is imported into a note and then exported again
- **THEN** the exported native artifact SHALL preserve the existing contract for `digest`, `references`, and `citation-analysis`

#### Scenario: conversation note round-trip is supported

- **WHEN** a conversation note created from `literature-explainer` is exported through `export-notes`
- **THEN** it SHALL export as markdown
- **AND** the exported markdown SHALL preserve the original conversation markdown payload

#### Scenario: custom note round-trip is supported

- **WHEN** a custom markdown note is imported and then exported
- **THEN** the exported markdown SHALL match the original markdown content

### Requirement: literature-explainer SHALL execute as a package workflow using the shared codec

`literature-explainer` MUST be hosted inside `literature-workbench-package`
and MUST reuse the package note codec for conversation-note creation.

#### Scenario: explainer bundle apply creates conversation note through shared codec

- **WHEN** `literature-explainer` applies a successful interactive bundle result
- **THEN** it SHALL resolve the conversation markdown artifact from the bundle
- **AND** it SHALL create a parent conversation note through the shared package codec
- **AND** the note DOM and payload contract SHALL remain compatible with existing export behavior

### Requirement: export-notes SHALL support package-managed generated and markdown-backed notes through the unified codec

`export-notes` MUST export all package-managed note kinds using the unified
codec rather than workflow-specific bespoke transformations.

#### Scenario: export handles digest and conversation notes together

- **WHEN** a selection contains both literature-digest generated notes and conversation notes
- **THEN** `export-notes` SHALL use the same package codec layer to determine note kind and export artifact shape
- **AND** each note SHALL still export according to its existing user-visible format

#### Scenario: export handles custom notes together with generated notes

- **WHEN** a selection contains both custom notes and generated notes
- **THEN** `export-notes` SHALL export them in one batch
- **AND** custom notes with markdown payload SHALL export as markdown

### Requirement: import-notes SHALL use the unified codec for structured and custom note creation

`import-notes` MUST create digest-family notes and custom markdown notes
through the same package codec layer.

#### Scenario: import creates digest-family notes through shared codec

- **WHEN** the user imports one or more literature-digest artifacts
- **THEN** the resulting notes SHALL be generated through the shared package codec
- **AND** their DOM and payload structure SHALL remain compatible with current export behavior

#### Scenario: import creates custom notes through shared codec

- **WHEN** the user imports one or more custom markdown files
- **THEN** the resulting notes SHALL be generated through the shared package codec
- **AND** those notes SHALL be exportable through `export-notes` without format loss
