# Proposal

## Why

The current workflow-package loader still fails in real Zotero runtime because it feeds `file://` URIs into `ChromeUtils.importESModule()`. That works in Node-based simulation but is not a reliable Zotero runtime module path, so packaged workflows still fail to scan/load in Zotero.

## What Changes

- Add a generic workflow module resource bridge backed by fixed builtin/user `resource://` roots
- Make workflow-package hooks load through `resource://` real-module imports in Zotero runtime
- Keep legacy single-workflow `.js` hooks on the text-loader compatibility path
- Support builtin and user workflow packages with the same runtime module strategy

## Impact

- Builtin and user workflow packages can both use package-local `.mjs` imports in Zotero runtime
- Runtime diagnostics become more accurate for package import/export failures
- Existing single-workflow user workflows remain compatible
