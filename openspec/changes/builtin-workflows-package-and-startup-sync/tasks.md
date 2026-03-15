## 1. OpenSpec Artifacts

- [x] 1.1 Create `proposal/design/spec/tasks` for `builtin-workflows-package-and-startup-sync`
- [x] 1.2 Add spec delta for built-in workflow package+startup sync and dual-directory merge

## 2. Built-in Packaging and Startup Sync

- [x] 2.1 Add packaged built-in workflow manifest under `workflows_builtin/`
- [x] 2.2 Include `workflows_builtin/**` in build assets
- [x] 2.3 Implement `syncBuiltinWorkflowsOnStartup()` force-overwrite behavior
- [x] 2.4 Invoke built-in sync before startup workflow registry scan

## 3. Dual-directory Workflow Registry

- [x] 3.1 Load both built-in directory and user `workflowDir`
- [x] 3.2 Merge workflow entries by id with user precedence
- [x] 3.3 Expose per-workflow source map (`builtin|user`) in runtime state

## 4. Dashboard Built-in Badge

- [x] 4.1 Extend home workflow snapshot entry with built-in source flag
- [x] 4.2 Render built-in badge for built-in workflows on dashboard home bubbles
- [x] 4.3 Ensure badge disappears when user same-id workflow overrides built-in

## 5. Path Governance & Test Semantics Alignment

- [x] 5.1 Clarify built-in/user directory rules in docs and preferences help text
- [x] 5.2 Remove misleading test defaults that set user `workflowDir` to `workflows_builtin`
- [x] 5.3 Add startup sync path-safety and fallback guarantees (same/nested guard + keep previous copy on replace failure)
- [x] 5.4 Add builtin manifest consistency checker script (`check:builtin-workflow-manifest`)

## 6. Validation

- [ ] 6.1 Run `npx tsc --noEmit`
- [ ] 6.2 Run targeted tests:
  - `test/core/41-workflow-scan-registration.test.ts`
  - `test/ui/01-startup-workflow-menu-init.test.ts`
  - `test/core/42-hooks-startup-template-cleanup.test.ts`
- [ ] 6.3 Run `openspec validate --change \"builtin-workflows-package-and-startup-sync\" --strict`
