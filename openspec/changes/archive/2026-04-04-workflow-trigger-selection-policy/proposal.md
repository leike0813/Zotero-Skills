## Why

当前 workflow 空选区触发判定依赖运行时推断，曾把 `provider=pass-through` 且未声明 `inputs.unit` 的 workflow 一律放行。这会误放行仍然依赖输入的 workflow，例如 `reference-matching`、`reference-note-editor`，导致用户可以触发但执行必然失败。

同时，项目也已经出现真正不依赖选区的 workflow，例如 `tag-manager` 与 `workflow-debug-probe`。它们需要在空选区下稳定启动，而且这个能力不应该绑定在某个 provider 上。

## What Changes

- 在 workflow manifest 顶层新增显式触发策略：`trigger.requiresSelection?: boolean`
- 默认行为保持严格不变：未声明时仍要求 selection
- preparation seam、workflow menu、runtime build/apply 统一读取显式 trigger 契约
- 删除基于 `provider=pass-through` 的空选区放行推断
- 仅为明确无输入的 builtin workflow 声明 `trigger.requiresSelection: false`
- 为 schema、loader、runtime 和 UI 增加回归测试

## Capabilities

### Modified Capabilities

- `workflow-manifest-authoring-schema`
- `workflow-execution-seams`
- `tag-vocabulary-management-workflow`

## Impact

- `src/schemas/workflow.schema.json`、`src/workflows/types.ts`：新增 manifest 顶层 `trigger.requiresSelection`
- `src/workflows/runtime.ts`、`src/workflows/declarativeRequestCompiler.ts`、`src/modules/workflowExecution/*`、`src/modules/workflowMenu.ts`：统一使用显式 trigger 判定
- `workflows_builtin/tag-vocabulary-package/tag-manager/workflow.json`
- `workflows_builtin/workflow-debug-probe/workflow.json`
- `test/core/20-workflow-loader-validation.test.ts`
- `test/core/56-declarative-request-compiler-guards.test.ts`
- `test/ui/40-gui-preferences-menu-scan.test.ts`
