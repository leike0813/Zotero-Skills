# Change: zotero-full-coverage-gate-rebalancing

## Why

`zotero-safe-suite-parity-ring-thickening` improved the retained Zotero
routine suite, but it still treated `full` mostly as a slightly thicker parity
ring. That is not enough for a CI gate whose purpose is to catch real-host
drift under the actual Zotero runtime.

The revised requirement is:

- `lite` remains the daily real-host regression baseline
- `full` becomes a stable-host coverage gate

This means `full` should optimize for coverage and repeatability, not speed,
while still excluding known high-instability classes such as
editor/picker/dialog interaction and remote GitHub sync.

## What Changes

- Rebalance Zotero `full` from a narrow parity ring into a broader stable-host
  coverage gate
- Expand full-only allowlists for stable real-host suites in `core`
- Expand full-only title allowlists for stable real-host suites in `ui` and
  `workflow`
- Record the new coverage-oriented `full` contract in governance docs and
  delta specs

## Impact

- Zotero `lite` remains compact enough for daily use
- Zotero `full` becomes meaningfully thicker and better aligned with CI gate
  responsibility
- Node still carries deep matrix and brittle/mock-heavy coverage
- The routine Zotero suite still excludes editor/picker/dialog and other known
  instability sources
