## 1. OpenSpec 契约固化

- [x] 1.1 完成 `proposal.md`，明确 provider-based 推断的回归风险与显式 trigger 方案
- [x] 1.2 完成 `design.md`，确认 `trigger.requiresSelection` 顶层契约、默认值与 runtime 语义
- [x] 1.3 完成三份 delta specs：`workflow-manifest-authoring-schema` / `workflow-execution-seams` / `tag-vocabulary-management-workflow`

## 2. Manifest 契约与类型实现（TDD）

- [x] 2.1 先编写测试：schema 接受 `trigger.requiresSelection: false`
- [x] 2.2 先编写测试：schema 拒绝非布尔 `trigger.requiresSelection`
- [x] 2.3 修改 `src/schemas/workflow.schema.json` 与 `src/workflows/types.ts`

## 3. 触发与执行语义收敛（TDD）

- [x] 3.1 先编写测试：显式 `trigger.requiresSelection: false` 的 workflow 在空选区菜单中保持可点
- [x] 3.2 先编写测试：未显式声明该字段的 pass-through workflow 在空选区下仍禁用
- [x] 3.3 先编写测试：显式 no-input generic-http workflow 可在空选区下完成声明式 request 编译
- [x] 3.4 修改 selection policy、preparation seam、workflow menu、runtime 和 declarative compiler
- [x] 3.5 删除旧的 provider-based 空选区放行推断

## 4. Builtin Workflow 迁移与回归

- [x] 4.1 为 `tag-manager` 显式声明 `trigger.requiresSelection: false`
- [x] 4.2 为 `workflow-debug-probe` 显式声明 `trigger.requiresSelection: false`
- [x] 4.3 保持 `reference-matching`、`reference-note-editor` 默认要求 selection
- [x] 4.4 运行 targeted tests 与 `npx tsc --noEmit`
