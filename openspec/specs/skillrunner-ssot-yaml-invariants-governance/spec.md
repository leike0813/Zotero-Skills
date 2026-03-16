# skillrunner-ssot-yaml-invariants-governance Specification

## Purpose
TBD - created by archiving change skillrunner-ssot-yaml-invariants-lockdown. Update Purpose after archive.
## Requirements
### Requirement: SkillRunner SSOT invariants MUST be machine-readable and uniquely identified

The system MUST define SkillRunner SSOT invariants in YAML files with globally unique invariant IDs.

#### Scenario: invariant entries follow required schema

- **WHEN** invariant guard runs
- **THEN** every invariant entry MUST include `id`, `domain`, `type`, `current_value`, `code_refs`, `doc_refs`, `spec_refs`, and `must`
- **AND** invariant IDs MUST be unique across provider/workspace invariant files

### Requirement: Invariant references MUST be bidirectionally consistent

Invariant IDs MUST be traceable in both SSOT docs and OpenSpec specs.

#### Scenario: doc/spec cross-reference is enforced

- **WHEN** invariant guard runs
- **THEN** each invariant `id` MUST appear in every file listed by `doc_refs`
- **AND** each invariant `id` MUST appear in every file listed by `spec_refs`
- **AND** missing references MUST fail the guard
- **AND** workspace invariant IDs MUST include `INV-WS-RUN-DIALOG-SINGLETON`, `INV-WS-CHAT-SSE-SINGLE-OWNER`, `INV-WS-STATE-RENDER-FROM-LEDGER`, `INV-WS-BACKEND-FLAGGED-GROUP-DISABLED`, `INV-WS-FIRST-FRAME-NO-FORCED-RUNNING`, `INV-WS-PENDING-EDGE-RULES`

### Requirement: YAML current values MUST match exported implementation facts

The invariant guard MUST compare YAML `current_value` with code-exported facts.

#### Scenario: drift between YAML and implementation facts is blocked

- **WHEN** any invariant `current_value` differs from resolved code facts
- **THEN** invariant guard MUST fail with rule ID, expected value, and actual value
- **AND** CI gate MUST treat this failure as blocking

