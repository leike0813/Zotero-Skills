## Context

Current localization behavior has three concrete problems:

1. File-level key ownership is not enforced, so new keys and duplicated keys drift over time.
2. Runtime fallback logic is duplicated across modules, with inconsistent locale behavior.
3. CI has no dedicated localization governance gate.

This change defines governance and implements minimum guardrails to keep behavior stable.

## Goals / Non-Goals

**Goals**

- Define localization SSOT rules (ownership, aliasing, fallback).
- Centralize fallback behavior for managed local backend display/toast strings.
- Add deterministic checks to block governance regressions in CI.

**Non-Goals**

- Full one-shot key cleanup across all modules.
- Introducing new user-facing runtime flows.
- Rewriting all `getString` call sites in this change.

## Decisions

### Decision 1: File ownership matrix is normative

- `addon.ftl` owns runtime-facing strings.
- `preferences.ftl` owns preferences pane strings.
- `mainWindow.ftl` owns main window/menu entry strings.
- Cross-file duplicates are forbidden by default and must be explicitly allowlisted during compatibility windows.

### Decision 2: Compatibility aliases are temporary and explicit

- Existing duplicated keys remain readable during transition.
- Governance script enforces an explicit allowlist for cross-file duplicates.
- Follow-up cleanup removes aliases once call sites are migrated.

### Decision 3: Managed local backend locale fallback is centralized

- Add a shared helper to:
  - detect unresolved localization values (`key` echo / prefixed-id echo),
  - resolve runtime locale (`zh` vs default),
  - provide deterministic locale fallback text.
- `resolveBackendDisplayName` must normalize legacy managed backend id (`skillrunner-local`) before display-name resolution.
- Runtime toasts for `up/down/abnormal-stop` must use helper-based fallback; fixed-English fallback is forbidden.

### Decision 4: Governance check is a blocking CI step

- Add `scripts/check-localization-governance.ts` to validate:
  - locale pair key parity (`en-US` vs `zh-CN`) per FTL file,
  - required key presence for managed local backend display + runtime toasts,
  - cross-file duplicate keys limited to explicit allowlist,
  - managed local backend localization paths wired to shared helper.
- Integrate check into `scripts/run-ci-gate.ts` before suite execution.

## Risks / Trade-offs

- [Risk] Compatibility allowlist may persist too long.  
  → Mitigation: keep allowlist short and document cleanup task explicitly.

- [Risk] Governance checks can fail on legitimate migration in progress.  
  → Mitigation: enforce explicit allowlist updates as part of the same change.

- [Risk] Runtime environment differences may affect fallback detection.  
  → Mitigation: use deterministic unresolved-value checks and cover with node tests.

## Migration Plan

1. Land governance SSOT documents + capability spec.
2. Add shared helper and migrate managed backend display/toast call paths.
3. Introduce governance checker and CI gate wiring.
4. Validate via typecheck + targeted core tests + governance script.
5. Keep compatibility aliases until follow-up cleanup change.
