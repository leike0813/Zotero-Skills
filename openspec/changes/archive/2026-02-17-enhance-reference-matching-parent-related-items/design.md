## Context

`reference-matching` 目前在 `applyResult` 内完成：

1. 解析 references note payload；
2. 匹配库内条目并回填 citekey；
3. 覆盖回写 note（payload + HTML table）。

当前流程没有把匹配命中的条目同步到父条目关联引用，因此与 Zotero 原生关联能力断开。

## Goals / Non-Goals

**Goals**

- 将 references note 匹配命中条目同步写入其父条目的 related items。
- 关联写入必须幂等，重复运行不重复添加。
- 保持现有 citekey 回填语义不回归。

**Non-Goals**

- 不改动 matching scorer、阈值策略与数据源策略。
- 不把关系写到 note 本身，只写到父条目。
- 不引入新的 provider 或后端协议变更。

## Decisions

### Decision 1: 关联目标固定为 references note 的父条目

- 从当前被处理的 references note 解析 parent item。
- 仅对 parent item 调用关联写入。
- 若 note 无父条目，则跳过关联写入并保留 citekey 回填结果。

### Decision 2: 关联写入来源为“本次高置信命中条目集合”

- 仅对成功回填 citekey 且可定位到库内 item 的候选执行关联。
- 未命中、低置信、冲突跳过的 reference 不参与关联写入。

### Decision 3: 幂等性由“集合差”保证

- 读取父条目已有 related keys；
- 计算 `toAdd = matchedKeys - existingKeys`；
- 仅写入 `toAdd`，避免重复添加；
- 重跑同一输入时 `toAdd` 为空，状态稳定。

### Decision 4: 保持解耦边界

- 业务逻辑继续驻留在 `workflows/reference-matching/hooks/applyResult.js`；
- 复用通用 handler（如 `handlers.parent.addRelated`）或等价通用接口；
- 不在 `src/**` 引入 reference-matching 专有分支。

## Risks / Trade-offs

- 若 citekey 能命中但无法唯一映射到 itemKey，关联写入会受限。此时优先安全跳过，避免误关联。
- 父条目已有大量 related items 时，集合比对应保持线性复杂度；先保证正确性，再评估必要优化。

## Test Strategy

1. 匹配成功后，父条目新增 related item（最小正向用例）。
2. 重复执行同一输入，不产生重复 related（幂等用例）。
3. 部分命中时，仅为命中项写入关联。
4. 无父条目场景不抛破坏性错误，note 回填路径仍可运行。
