## Why

当前 workflow 参数声明中，只要定义了 `enum`，运行时就会把它当成硬约束；UI 也只渲染不可编辑下拉框。  
这导致我们无法表达“给出推荐值，但允许高级用户输入自定义值”的真实需求，限制了 Skill 参数演进与跨 workflow 参数复用。

## What Changes

- 扩展 workflow 参数声明合同：新增 `allowCustom`，用于声明 `enum` 是推荐集合还是硬限制。
- 统一参数归一化逻辑：当 `allowCustom=true` 时，`enum` 作为推荐项，字符串参数允许非枚举值通过类型校验。
- 调整设置 UI：对 `enum + allowCustom=true` 的字符串参数，改为“下拉推荐 + 可编辑输入”的组合控件。
- 保持向后兼容：未声明 `allowCustom` 或为 `false` 时，继续沿用现有枚举硬限制与下拉行为。
- 补充测试与文档，明确合同语义和交互预期。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workflow-manifest-authoring-schema`: 扩展参数 schema 支持 `allowCustom` 声明。
- `workflow-settings-dialog-model-split`: 扩展渲染模型与序列化行为，支持“推荐枚举 + 自定义输入”组合交互。
- `workflow-settings-domain-decoupling`: 调整参数归一化规则，在 `allowCustom=true` 时放宽枚举限制但保持类型约束。

## Impact

- 主要影响文件：`src/workflows/types.ts`、`src/schemas/workflow.schema.json`、`src/modules/workflowSettingsDomain.ts`、`src/modules/workflowSettingsDialogModel.ts`、`src/modules/workflowSettingsDialog.ts`。
- 主要影响测试：`test/core/20-workflow-loader-validation.test.ts`、`test/core/49-workflow-settings-domain.test.ts`、`test/ui/50-workflow-settings-dialog-model.test.ts`（必要时补充 UI 执行链路测试）。
- 该 change 仅调整参数合同与通用设置 UI/归一化，不引入具体业务 workflow 逻辑。
