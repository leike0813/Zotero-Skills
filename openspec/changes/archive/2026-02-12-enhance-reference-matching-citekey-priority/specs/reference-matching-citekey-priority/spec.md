## ADDED Requirements

### Requirement: Reference matching MUST prioritize exact CiteKey match and short-circuit on success
`reference-matching` workflow MUST 在每条参考文献匹配时优先执行 CiteKey 精确匹配。命中后 MUST 直接采用该结果并结束该条匹配流程，不再进入评分匹配。

#### Scenario: Explicit CiteKey in reference payload matches library item
- **WHEN** 某条 reference 已包含 `citekey`（或 `citeKey`）且与库内候选条目 CiteKey 精确一致
- **THEN** 系统 MUST 直接将该 CiteKey 回写到结果
- **AND** MUST NOT 对该条 reference 继续执行标题/作者/年份评分匹配

#### Scenario: No explicit CiteKey but predicted CiteKey matches library item
- **WHEN** 某条 reference 未提供显式 CiteKey，且由模板生成的预测 CiteKey 与库内候选条目精确一致
- **THEN** 系统 MUST 直接采用该命中结果并回写
- **AND** MUST NOT 对该条 reference 继续执行评分匹配

### Requirement: CiteKey match stage MUST resolve ambiguity before short-circuit
当 CiteKey 匹配命中多个候选或无法唯一定位时，系统 MUST 将其视为歧义，不得短路写入，并 MUST 回退到下一匹配阶段。

#### Scenario: Multiple candidates share the same matched CiteKey
- **WHEN** 显式或预测 CiteKey 在候选集中命中超过 1 条条目
- **THEN** 系统 MUST 将该 CiteKey 命中判定为歧义
- **AND** MUST NOT 直接回写 CiteKey
- **AND** MUST 回退执行评分匹配流程

#### Scenario: CiteKey match misses all candidates
- **WHEN** 显式或预测 CiteKey 在候选集中无命中
- **THEN** 系统 MUST 回退执行评分匹配流程
- **AND** MUST 保持当前 CiteKey 阶段不产生回写副作用

### Requirement: Score-based matching MUST remain as fallback path
当 CiteKey 阶段未形成唯一命中时，系统 MUST 维持现有 `title/author/year` 评分逻辑作为兜底路径，保障向后兼容。

#### Scenario: Fallback score match succeeds after CiteKey stage fails
- **WHEN** 某条 reference 在 CiteKey 阶段未命中或歧义，且评分阶段满足既有高置信阈值
- **THEN** 系统 MUST 采用评分阶段结果回写 CiteKey

#### Scenario: Both CiteKey stage and score stage fail
- **WHEN** 某条 reference 在 CiteKey 阶段和评分阶段都未形成可接受命中
- **THEN** 系统 MUST 不回写 CiteKey
- **AND** MUST 保持该条 reference 其他字段不变
