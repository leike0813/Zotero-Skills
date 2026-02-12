## Context

`literature-digest` workflow 当前会回写两条 note（digest / references）。  
digest note 已包含：

- 可见正文（markdown 渲染后的 HTML）
- `digest-markdown` payload（用于后续机器读取）

但缺少一个稳定“来源附件标识”，导致外部系统要通过路径或标题猜测输入文件。  
本 change 选择在 digest note 中增加隐藏来源元数据，仅写 `itemKey`，把路径解析留给消费端（例如 Obsidian ETA 模板结合父条目附件列表完成映射）。

## Goals / Non-Goals

**Goals:**

- 在 digest note 回写时增加隐藏来源元数据，不改变可见正文体验。
- 元数据以 `itemKey` 为单一事实源，避免路径耦合。
- 保持现有 payload 与 references note 行为不回归。

**Non-Goals:**

- 不在本 change 中写入绝对路径或相对路径。
- 不修改 Obsidian 端模板逻辑。
- 不改变 `literature-digest` 的输入筛选规则。

## Decisions

### Decision 1: 元数据载体

使用 digest note 内的隐藏 HTML 元素承载来源字段，采用 `data-zs-*` 命名约定。  
该块只用于机器读取，不作为用户可见内容。

### Decision 2: 来源字段内容

仅写入输入 markdown 附件的 `itemKey`，字段名为 `source_markdown_item_key`。  
不存储文件系统路径，避免跨平台与跨机器路径差异。

### Decision 3: 数据来源

优先从本次运行上下文（request / selection）中解析被处理的 markdown 附件对象，再读取其 `itemKey`。  
若本次运行无法得到合法 `itemKey`，则降级为“不写来源字段但继续回写 digest/references”。

### Decision 4: 兼容性边界

已有 digest note 的更新逻辑（upsert + 去重）保持不变。  
新增元数据块作为附加结构，不替换 `digest-markdown` payload，也不调整 references note 结构。

## Risks / Trade-offs

- 若未来外部系统需要更多上下文（如 attachment title / parent key），单一 `itemKey` 可能不足；本 change 先控制范围，后续再扩展字段。
- 运行上下文与附件解析链路存在历史差异，需通过测试覆盖不同执行入口（单测与 mock e2e）。

## Migration Plan

1. 先补测试：digest note 中新增隐藏来源字段断言。
2. 修改 `applyResult` 组装逻辑，注入隐藏元数据块。
3. 运行构建与测试，确保旧断言与行为不回归。
4. 更新 OpenSpec 任务状态与验证记录。

## Open Questions

- （无）
