## Context

当前 `tag-manager` renderer 采用“每次 `patchState` 全量重绘根节点”的模式，导致：

- facet 列当前为 `<select>`，与协议“facet 不应被用户随意变更”的约束冲突；
- 列表区为无表头 `div` 栅格，滚动后列语义丢失；
- Export 仅更新内部 `exportText` 状态，未提供可见反馈或复制出口；
- 搜索框在每次输入触发重绘后失焦，连续输入中断；
- 仅有全文检索，缺少按 facet 分面筛选。

## Goals / Non-Goals

**Goals:**

- 把 facet 交互改为只读展示，避免误操作。
- 提供 sticky header 的表格化编辑体验。
- 让 Export 动作具备可感知结果（可见 + 可复制）。
- 消除搜索输入失焦回归，支持连续输入。
- 新增 8 个 facet 的组合过滤，并基于当前数据动态生成选项。
- 过滤入口采用弹出式子窗体，避免挤占主列表编辑空间。

**Non-Goals:**

- 不改动词表持久化格式与导入协议。
- 不新增或变更 facet 枚举定义（仍沿用现有协议）。
- 不改动 `tag-regulator` workflow 消费契约（仍消费 `facet:value`）。

## Decisions

### Decision 1: 列表切换为“表头 + 滚动体”结构并固定表头

- 采用显式列头（Tag/Facet/Source/Note/Deprecated/Delete）。
- 使用滚动容器 + `position: sticky` 固定表头。
- 保持列宽策略与现有编辑控件兼容，避免布局抖动。

### Decision 2: Facet 改为只读字段

- facet 列由 `<select>` 改为只读文本节点（或只读 input）。
- 保留 facet 在数据模型中的持久字段，不删除。
- 如 tag 前缀与 facet 不一致，继续通过既有 validation 报错，而不是允许用户通过 UI 手工改 facet 规避约束。

### Decision 3: Export 必须“可见且可复制”

- Export 按钮触发后，更新一个可见导出结果区（只读文本域）。
- 提供 Copy 动作，将结果复制到剪贴板（不可用时给出确定性提示）。
- 导出内容仍为非 deprecated 条目的稳定排序 `facet:value` 列表（与序列化一致）。

### Decision 4: 搜索输入焦点保持采用“重绘后恢复”

- 在触发 `patchState` 前记录搜索框选区/焦点状态。
- 重绘后恢复焦点与光标位置，避免每输入一个字符就需要重新点击。
- 保持“输入即过滤”的即时反馈，不退回到提交式搜索。

### Decision 5: Facet 过滤采用弹出式子窗体 + 组合过滤模型

- 新增 `facetFilters` 状态：每个 facet 对应一个多选值集合。
- 候选选项由当前 entries 动态计算（按 facet 分组去重并稳定排序）。
- 主工具栏保留单一 Filter 按钮；点击后打开内部子窗体，子窗体中按 facet 分组展示多选项。
- 子窗体提供 Apply/Clear/Close 操作，避免主界面长期占用垂直空间。
- 过滤逻辑采用“跨 facet 取交集、facet 内取并集”，再与全文搜索共同作用。

## Risks / Trade-offs

- [Risk] UI 状态增加导致 renderer 逻辑复杂化  
  -> Mitigation: 抽离纯函数（选项计算、过滤谓词、导出文本）并补充独立单测。

- [Risk] sticky header 在不同宿主窗口样式下表现不一致  
  -> Mitigation: 采用最小 CSS 依赖并通过 workflow 测试覆盖基础可见性。

- [Risk] 剪贴板 API 在部分运行时不可用  
  -> Mitigation: 保证可见导出文本始终可手工复制，并输出明确提示。

- [Risk] 剪贴板接口在不同运行时桥接差异较大  
  -> Mitigation: 保持可见文本导出始终可手工复制，并在复制失败时给出确定性提示。
