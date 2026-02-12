## Context

当前 `reference-matching` workflow 已支持：

- 从 references note 解析 payload
- 基于 `title/author/year` 进行评分匹配
- 将 `citekey` 回写至 payload 与表格

但这一路径在元数据边界场景下会漏配。用户已确定新策略：

1. CiteKey 命中为最高优先级，命中后立即短路；
2. 在匹配前增加“内部 CiteKey 预测”；
3. 预测模板可在 Workflow Settings 配置，默认对齐 Better BibTeX 默认模板语义。

约束：

- 兼容现有 workflow 与历史 note，不破坏当前回写结构；
- 不引入外部服务依赖；
- 维持 `zotero-api` / `bbt-json` 两条数据源路径的统一匹配逻辑。

## Goals / Non-Goals

**Goals:**

- 为每条参考文献建立“CiteKey 精确匹配优先”的稳定路径。
- 通过可配置模板生成内部预测 CiteKey，并参与精确匹配尝试。
- 保留现有评分匹配为兜底路径，确保向后兼容。
- 在 Workflow Settings 暴露模板参数，允许用户按习惯调整。

**Non-Goals:**

- 不完整复刻 Better BibTeX 全部 citekey 解析/消歧引擎。
- 不在本次 change 中引入交互式人工确认。
- 不改变 references note 的 payload schema 主体结构。

## Decisions

### Decision 1: 匹配顺序固定为“显式 CiteKey -> 预测 CiteKey -> 评分匹配”

执行顺序：

1. 若 reference 自带 `citekey/citeKey`，先做精确匹配；
2. 若未命中，则按模板生成预测 CiteKey，再做精确匹配；
3. 若仍未命中，回退至现有 `title/author/year` 评分匹配。

命中规则：

- 精确匹配成功即短路，不再进行后续步骤；
- 若同一 CiteKey 对应多个候选（异常数据），视为歧义，回退下一阶段，不直接写入。

备选方案：

- 仅在评分失败后再做 CiteKey 匹配。  
未选原因：会错过“低质量标题但高质量 CiteKey”的高置信捷径，且与用户“CiteKey 最高优先级”决策冲突。

### Decision 2: 内部 CiteKey 预测采用“可配置模板 + 受限占位符”

新增 workflow 参数（并映射到 Workflow Settings）：

- `citekey_template`（string）

默认值语义对齐 Better BibTeX 默认风格（作者 + 年份 + 标题片段），但实现限定在本插件可控范围：

- 支持占位符（示例）：`{author}`, `{year}`, `{title}`
- 统一归一化：小写、去重音、移除大部分标点、压缩分隔符
- 对空字段做安全降级（如无作者时允许 `{title}` 驱动）

备选方案：

- 完整解释并执行 BBT 模板 DSL。  
未选原因：复杂度高、维护成本高，且与 BBT 版本行为强耦合，不适合作为本阶段稳定能力。

### Decision 3: 库内候选构建时引入 CiteKey 索引映射

对数据源产出的候选条目构建：

- `candidate.citekey` 常规字段
- `Map<citekey, candidate[]>` 索引（归一化键）

引用匹配时优先查索引，避免全量评分扫描的额外成本。

备选方案：

- 每条 reference 都在候选列表中线性遍历找 CiteKey。  
未选原因：性能不稳定，且会重复执行相同归一化计算。

### Decision 4: 回写策略保持不变，仅改变匹配来源

保持现有回写契约：

- payload JSON 更新 `citekey`
- table `Citekey` 列同步更新
- note 结构与非目标区域尽量不改动

此决策避免引入新的 note 格式迁移风险。

## Risks / Trade-offs

- [模板表达力低于完整 BBT DSL] -> 明确支持范围并允许用户覆盖模板；后续按需求迭代占位符。
- [预测 CiteKey 可能与库内实际 key 规范不一致] -> 仅作为“精确命中尝试”，失败后回退评分匹配，不造成误写。
- [同 key 多条目引发歧义] -> 将其标记为歧义并回退，不短路写入。
- [新增参数破坏旧配置] -> 在 settings 归一化层提供默认值回填与非法值兜底。

## Migration Plan

1. 先补测试：优先级短路、预测模板命中、模板可配置、歧义回退、评分兜底。
2. 在 `workflow.json` 增加 `citekey_template` 参数定义与默认值。
3. 在 `applyResult` 中实现：
   - 候选 CiteKey 索引构建
   - 显式/预测 CiteKey 精确匹配
   - 命中短路 + 兜底评分
4. 在 Workflow Settings 接入模板参数读写与默认值归一化。
5. 更新文档并执行回归测试。

## Open Questions

- 默认模板字符串的具体字面值是否需要严格与用户本地 BBT 设置完全一致，还是以“默认语义一致”作为验收标准。
- 是否需要在结果中写入“命中来源”（explicit/predicted/scored）用于调试可观测性。
