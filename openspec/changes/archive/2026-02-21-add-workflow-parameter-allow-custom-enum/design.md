## Context

目前 workflow 参数处理链路分三层：

- 声明合同：`workflow.schema.json` + `WorkflowParameterSchema`
- 领域归一化：`normalizeWorkflowParamsBySchema`
- 设置 UI：`workflowSettingsDialog` / `workflowSettingsDialogModel`

现状中，只要参数包含 `enum`，领域层会强制枚举匹配，UI 层会渲染只读选择器，无法输入枚举外字符串。  
这与“推荐值 + 自定义值”的实际需求冲突。

## Goals / Non-Goals

**Goals:**

- 在合同层新增 `allowCustom`，表达枚举是否为推荐集合。
- 在领域层支持 `allowCustom=true` 的字符串参数接受非枚举值。
- 在 UI 层将对应参数渲染为“下拉推荐 + 可编辑输入”组合控件。
- 保持老行为默认不变（兼容已有 workflow）。

**Non-Goals:**

- 不改 provider runtime option 合同（本次仅 workflow 参数）。
- 不改业务 workflow hook 逻辑。
- 不引入新的参数类型。

## Decisions

### Decision 1: 合同层新增 `allowCustom`（默认 false）

- 仅作用于 `type=string` 的参数。
- 对 `enum` 未定义的字段，`allowCustom` 无语义影响。
- schema 与 TS 类型同步新增该字段。

### Decision 2: 领域归一化按 `allowCustom` 分支

- `allowCustom=false`（默认）：维持现有行为，非枚举值回退默认值或丢弃。
- `allowCustom=true`：字符串值只做类型与空值处理，不再要求属于 `enum`。
- 数值范围与布尔处理保持现有逻辑，不受 `allowCustom` 影响。

### Decision 3: UI 采用组合控件，保持单一序列化出口

- `enum + allowCustom=true` 时渲染：
  - 推荐下拉（快速选择常用值）
  - 可编辑文本输入（输入自定义值）
- 下拉选择会同步填充输入框；最终提交值以输入框为准。
- `enum + allowCustom=false` 继续渲染单下拉；无 `enum` 继续渲染原生输入控件。

### Decision 4: 行为兼容与渐进启用

- 未显式声明 `allowCustom` 的历史 workflow 行为不变。
- 新语义仅在 workflow 显式声明后生效，避免隐式破坏。

## Risks / Trade-offs

- [Risk] 组合控件增加 UI 状态复杂度  
  -> Mitigation: 继续通过 `collectSchemaValues` 单出口收敛，避免新增并行序列化分支。

- [Risk] workflow 声明误用 `allowCustom` 导致预期不清  
  -> Mitigation: 在 schema 与文档中明确“默认 false，仅 string 参数生效”。

- [Risk] 枚举推荐列表与真实可用值漂移  
  -> Mitigation: 将 `enum` 明确为“推荐列表”，并在需要硬限制时保持 `allowCustom=false`。
