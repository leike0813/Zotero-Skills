## Context

当前 `tag-manager` 在上一轮增强后仍有三类核心偏差：

- 过滤模型偏复杂（按 facet 值筛选）且默认状态不符合“全 facet 显示”预期；
- patchState 全量重绘导致输入过程中滚动位置回顶；
- 列语义与交互未满足当前操作习惯（Facet/Tag/Source/导入区均需再收敛）。

此外，前一 change 已完成但尚未归档，本次作为后续独立 change，需明确“覆盖前一轮的部分交互决策”，并保持协议与存储兼容。

## Goals / Non-Goals

**Goals:**

- 过滤只按 facet 维度，默认 8 facet 全选，实时生效。
- 过滤弹窗简化为“无动作按钮”模式，支持点外关闭与按钮 toggle 关闭。
- 编辑输入时保持滚动位置稳定。
- Source 列只读；由 `Add` 新建的条目其 Source 固定为 `manual`。
- Facet 列前置并收窄；Facet 下拉右侧显示半角冒号分隔符；Tag 列展示/编辑后缀；Facet 下拉可选 8 枚举。
- 导入区分组显示并修正文案与下拉交互。

**Non-Goals:**

- 不修改词表持久化结构版本号。
- 不新增 facet 枚举类型。
- 不调整导入 YAML 字段集合与校验协议。

## Decisions

### Decision 1: 过滤模型改为 facet 级布尔开关（默认全开）

- 使用 `facetVisibility: Record<facet, boolean>` 取代 facet-value 多选结构。
- 初始状态 8 个 facet 全为 `true`。
- 过滤条件：仅判断条目 facet 是否可见；再叠加文本搜索。

### Decision 2: 过滤弹窗改为实时模式

- 弹窗中每个 facet 提供一个 checkbox；勾选变化立即触发过滤。
- 移除 `Clear/Apply/Delete` 按钮，减少状态同步复杂度。
- 弹窗关闭触发：
  - 再次点击 `Filter`；
  - 点击弹窗外部区域（overlay/backdrop）。

### Decision 3: 保持滚动位置

- 在触发 `patchState` 前记录滚动容器 `scrollTop`。
- 重绘后恢复同一容器的 `scrollTop`，避免输入导致列表回顶。
- 仅在用户主动执行“新增条目并定位顶部”等显式行为时允许改变滚动位置。

### Decision 4: Facet/Tag/Source 列重定义

- 列顺序调整为：`Facet | Tag | Source | Note | Deprecated | Delete`。
- Facet 列恢复下拉，候选固定为 8 个 facet（不可自由输入）。
- Facet 列使用下拉选择具体 facet；下拉右侧仅显示分隔符 `:`；Tag 列编辑值仅为后缀，渲染时不重复显示前缀。
- 当用户切换 Facet 下拉时，系统实时按“当前 facet + 当前 tag 后缀”重组完整 tag，确保持久化始终符合 tag 规范。
- Source 列改为只读；通过 `Add` 新建的条目其 Source 统一初始化为 `manual` 并以此持久化。

### Decision 5: 导入区独立分组与语义化文案

- 将导入相关控件与通用工具按钮分区（视觉上隔开）。
- 文案统一为 `Dry Run`、`On Duplicate:`。
- `On Duplicate` 下拉仅展示策略值标签（`Skip/Overwrite/Error`），左侧独立标签显示语义。
- 修复下拉交互，确保选择变化可稳定写入 state。

## Risks / Trade-offs

- [Risk] Tag 列改为后缀后，旧数据兼容与校验逻辑可能冲突  
  -> Mitigation: 在 normalize/serialize 路径统一做“后缀<->完整 tag”转换，并保留现有 validation。

- [Risk] Source 只读后，新建与导入条目的来源语义可能不一致  
  -> Mitigation: 明确“仅 Add 新建条目固定 manual”，导入条目保留来源字段并禁止手工编辑。

- [Risk] 点外关闭实现不当可能误关闭弹窗  
  -> Mitigation: 使用 overlay 命中判断，仅在 overlay 本身点击时关闭，避免点击弹窗内部触发关闭。
