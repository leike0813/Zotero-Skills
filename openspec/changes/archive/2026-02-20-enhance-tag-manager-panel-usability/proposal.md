## Why

`tag-manager` workflow 已具备协议对齐的 CRUD/import/export 基础能力，但当前面板交互存在明显可用性缺陷：facet 可被误改、缺少固定表头、export 无可见产出、搜索输入会丢焦点、缺少 facet 组合过滤。  
这些问题直接影响词表维护效率与正确性，且会降低 `tag-regulator` 下游输入质量。

## What Changes

- 调整 tag 列表渲染：facet 从可编辑下拉框改为只读展示列（禁止直接改 facet）。
- 增加表头并固定在滚动容器顶部，保证大数据量编辑时列语义始终可见。
- 修复 export 交互：点击 Export 后必须产生可见、可复制的导出结果。
- 修复搜索框焦点回归：增量搜索输入时不得丢失焦点与连续输入能力。
- 新增 facet 过滤能力：
  - 支持 8 个 facet 的自由组合筛选；
  - 每个 facet 的选项来自当前词表的动态值集合；
  - 过滤入口采用弹出式子窗体（点击过滤按钮打开）；
  - 过滤结果与文本搜索联合作用。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `tag-vocabulary-management-workflow`: 补充 tag-manager 面板可用性与过滤交互要求（只读 facet、sticky header、有效导出、稳定搜索、组合 facet 过滤）。

## Impact

- 主要影响 `workflows/tag-manager/hooks/applyResult.js` 的 renderer 与状态管理。
- 需要扩展 `test/workflow-tag-manager/*.test.ts` 覆盖新增 UI 语义与回归场景。
- 不改变持久化结构与 `tag-regulator` 的消费协议（仍为 `facet:value` 字符串数组）。
