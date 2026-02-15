## Why

We need a strict second-pass review that directly answers one question: what residual architecture risk remains relative to `doc/architecture-hardening-baseline.md` after the completed hardening/refactor wave.  
The previous implementation drifted into broader roadmap planning; this change resets scope to baseline-only reassessment.

## What Changes

- Reassess only the baseline-defined debt/boundary items (`D-*`, `HB-*`, acceptance checklist) against current implementation evidence.
- Produce a baseline-focused reassessment report under `doc/` with normalized risk entries and explicit scoring rationale.
- Update baseline documentation with a pointer to the reassessment result for traceable follow-up.

## Capabilities

### New Capabilities

- `architecture-residual-risk-reassessment`: Defines a baseline-constrained reassessment workflow and output contract.

### Modified Capabilities

- None.

## Impact

- Affects documentation and OpenSpec artifacts only:
  - `openspec/changes/reassess-architecture-residual-risks/*`
  - `doc/architecture-hardening-baseline.md`
  - `doc/architecture-hardening-baseline-reassessment.md` (new)
- No runtime behavior/code changes.
