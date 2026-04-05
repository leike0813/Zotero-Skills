## Context

当前系统在“空选区是否允许触发”这个问题上没有显式 manifest 契约，只在局部实现里用 provider 特征做推断。这带来两个问题：

1. 推断过宽，误放行仍然依赖输入的 workflow。
2. 语义不通用，无法表达“无输入 workflow 可以跨 provider 空选区触发”。

这次修复要把选择策略前移到 manifest 契约层，让菜单 gating、preparation gating、request build 和 apply 都围绕同一条规则工作。

## Goals / Non-Goals

**Goals**

- 用显式 manifest 契约表达 workflow 是否要求 selection
- 保持默认行为向后兼容且严格
- 让真正无输入的 workflow 在空选区下可触发，不绑定具体 provider
- 消除 provider-based 推断，避免同类回归

**Non-Goals**

- 不把“是否要求 selection”塞回 `inputs`、`execution` 或 provider 配置
- 不自动根据 `provider`、`request.kind`、`hooks`、`inputs.unit` 猜测空选区可执行性
- 不批量迁移所有 builtin workflow；只有已确认无输入的 workflow 会显式声明

## Decisions

### Decision 1: 使用顶层 `trigger.requiresSelection`

- manifest 顶层新增：
  - `trigger.requiresSelection?: boolean`
- 语义：
  - `false`：允许空选区触发
  - `true` 或省略：要求 selection

这样可以把“触发入口约束”与“输入单元建模”分离，避免 `inputs` 既表达数据单位又表达触发权限。

### Decision 2: 默认值固定为 `true`

默认继续要求 selection，只有显式声明 `false` 才放行。这样可以保证旧 workflow 不会因为缺省值变化而被误放行。

### Decision 3: Runtime 对显式无输入 workflow 生成一个空 selection 执行单元

- 当 workflow 显式声明 `trigger.requiresSelection: false`
- 且触发时 selection 为空
- runtime 会生成一次空 selection 单元进入 build/apply

如果 workflow 原本有非空 selection，但被 `filterInputs` 过滤为空，则仍按“无合法输入”处理，不把它误当成 no-input workflow 成功路径。

### Decision 4: 声明式请求编译器按同一策略放宽 target parent 解析

声明式编译器不再假设空选区一定非法。对显式 no-input workflow：

- `targetParentID` 可省略
- `taskName` 回退到 `task`
- 没有 source attachment 时允许空数组

这样 no-input workflow 可以跨 provider 使用统一的空选区触发语义，而不是只能依赖 pass-through 特判。

### Decision 5: Builtin workflow 只迁移已确认无输入的条目

本次只为下列 workflow 显式声明 `trigger.requiresSelection: false`：

- `tag-manager`
- `workflow-debug-probe`

`reference-matching`、`reference-note-editor` 等仍保持默认要求 selection。

## Risks / Trade-offs

- 显式声明比运行时推断多写一个字段，但换来稳定契约与更低误判成本。
- 声明式 generic-http / skillrunner no-input workflow 现在可以空选区构建请求；若 workflow 自己仍声明了依赖附件的 upload selector，它仍会在编译阶段失败，这属于 workflow 作者的真实契约错误，不再由 trigger 策略替其掩盖。

## Migration Plan

1. 先补 schema / loader / UI / compiler 回归测试
2. 落地 `trigger.requiresSelection` 类型与 schema
3. 移除 provider-based 推断，统一接入显式 trigger
4. 迁移 `tag-manager` 与 `workflow-debug-probe`
5. 运行 targeted tests 和类型检查
