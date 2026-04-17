# zotero-safe-suite-core-smoke-pruning

## Why

The current Zotero routine suite still executes too many tests that are better
suited to Node or full-only coverage. This increases wall-clock time, raises the
chance of GUI-host flakiness, and dilutes the signal of real-host smoke runs.

## What Changes

- shrink the routine Zotero suite to a documented smoke allowlist
- keep Node coverage intact while moving non-smoke Zotero cases to `node-only`
- retain only canonical success paths and minimal host parity in retained
  workflow files
- document the retained Zotero `core`, `ui`, and `workflow` smoke inventory

## Impact

- faster and more stable Zotero routine runs
- clearer separation between real-host smoke coverage and Node regression depth
- no runner changes, no bundling changes, and no product-code changes
