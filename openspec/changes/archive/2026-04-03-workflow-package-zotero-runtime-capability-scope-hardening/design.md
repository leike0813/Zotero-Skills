# Design

## Decision

- `WorkflowRuntimeContext` becomes the canonical capability container for package hook execution
- Package hooks establish a package-local runtime scope before running package code
- Package `lib/runtime.mjs` accessors prefer the hook-provided runtime scope and only use `globalThis` as a minimal fallback
- Capability access stays package-local; no tag-vocabulary or reference-note business logic moves into plugin core

## Runtime model

- The workflow execution chain builds one explicit capability scope per hook execution:
  - `zotero`
  - `addon`
  - `fetch`
  - `Buffer`
  - `btoa` / `atob`
  - `TextEncoder` / `TextDecoder`
  - browser-only capabilities only where currently needed
- Each workflow-package hook wraps its body with the package-local runtime scope helper
- Package-local helpers such as prefs/items/base64/fetch accessors read from that scope first

## Package changes

- `tag-vocabulary-package`
  - tag manager / tag regulator hooks establish package runtime scope
  - prefs/items/fetch/base64 helpers resolve through package runtime accessors
- `reference-workbench-package`
  - reference-note-editor / reference-matching / literature-digest hooks establish package runtime scope where package helpers need runtime access
  - references note and HTML codec helpers resolve through package runtime accessors

## Tests

- Replace global execution-scope assumptions in package lib tests with package-local runtime scope tests
- Keep governance protection against bare `Zotero` / `addon` usage in package `.mjs`
- Re-run targeted loader, runtime, and workflow regressions
