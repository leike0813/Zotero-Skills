## Why

上一轮 `tag-manager` 可用性增强已经修复了部分问题，但当前实际使用中仍存在过滤逻辑、弹窗交互、滚动稳定性、列布局与导入区交互不一致等问题。  
这些问题会显著影响中大规模词表编辑效率，因此需要新增独立 change 进行二次收敛，而不混入已完成的前一 change。

## What Changes

- 简化过滤模型：只按 facet 过滤，不再做 facet 内值筛选；默认 8 个 facet 全选，取消勾选后才隐藏对应 facet。
- 调整过滤弹窗交互：去掉 `Clear/Apply/Delete`；勾选变更实时生效；点击弹窗外或再次点击 `Filter` 关闭。
- 修复编辑时滚动重置：输入任意字符后保持当前滚动位置，不回到顶部。
- 锁定 `Source` 列：设为不可编辑，由 `tag-manager` 页面中的 `Add` 按钮新增的条目，`Source` 统一显示/持久化为 `manual`。
- 调整列布局与 facet/tag 交互：
  - Facet 列移至第一列，宽度收窄至当前约 1/3，下拉右侧仅显示半角冒号 `:` 作为分隔；
  - Tag 列仅显示 facet 后缀（不重复显示前缀）；
  - Facet 恢复为可用下拉菜单，仅允许 8 个预定义 facet， 确保下拉菜单工作正常。
  - 用户通过下拉菜单修改 Facet 列时，对应的 tag 本体也要相应改动，最终 tag 永远是由 Facet 列的选项和 Tag 列的输入文本组合而成（遵循 tag 规范）
- 重构导入区布局与文案：
  - `Import YAML`、`Dry Run`、`On Duplicate` 作为独立导入区；
  - 文案改为 `Dry Run` 与 `On Duplicate:`；
  - 仅在右侧下拉展示策略选项（如 `Skip/Overwrite/Error`），并修复下拉交互异常。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `tag-vocabulary-management-workflow`: 修改 tag-manager 面板的过滤模型、列布局、编辑行为与导入区交互要求。

## Impact

- 主要影响：`workflows/tag-manager/hooks/applyResult.js` 的 renderer 状态机、输入归一化与列表渲染逻辑。
- 测试影响：`test/workflow-tag-manager/**/*.test.ts` 需补充/改造 UI 行为回归用例。
- 不改变：词表持久化 key、导入 YAML 协议字段、`tag-regulator` 的 `facet:value` 消费契约。
