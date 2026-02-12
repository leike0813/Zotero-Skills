## Context

当前 `reference-matching` 的 `citekey_template` 仅支持占位符替换（`{author}/{title}/{year}`），无法解析 Better BibTeX 常见的表达式模板（如 `auth.lower + '_' + title... + '_' + year`）。这会导致用户在 BBT 中已使用的 CiteKey 规则无法直接迁移到本 workflow，降低“预测 CiteKey 精确命中”路径的价值。

现状约束：

- workflow 运行于 Zotero 插件内部，不能引入复杂外部运行时。
- 现有匹配主流程（显式 CiteKey -> 预测 CiteKey -> 评分兜底）必须保持向后兼容。
- 需要失败安全：模板解析或执行异常不能中断 workflow。

## Goals / Non-Goals

**Goals:**

- 为 `reference-matching` 提供 BBT-Lite 表达式能力，支持 `Auth/Year/Title` 三类对象的链式方法。
- 支持字符串拼接表达式（`+`）与字符串字面量，满足主流 BBT 模板迁移场景。
- 保留旧占位符模板兼容（如 `{author}_{title}_{year}`）。
- 失败时自动回退到既有匹配路径，不产生错误写入。
- 建立完整测试矩阵，覆盖命中、歧义、降级与回退。

**Non-Goals:**

- 不完整复刻 Better BibTeX 全量模板引擎（含全部对象、宏、条件分支与高级语法）。
- 不修改 reference note 的 payload 结构。
- 不引入远端服务依赖或运行时动态求值（如 `eval`）。

## Decisions

### Decision 1: 采用“受限语法解析器 + 内置执行器”，不直接执行任意表达式

选择：

- 对 `citekey_template` 提供 BBT-Lite 解析器，只允许：
  - 标识符与链式调用（`auth.lower`, `title.nopunct.skipwords.select(1,1)`）
  - 字符串字面量（`'_'`, `'-'`）
  - `+` 拼接

原因：

- 安全可控，可在插件内稳定运行。
- 便于做静态校验与错误提示，避免运行时不确定行为。

备选方案：

- 直接 `eval` 用户表达式。  
未选原因：安全风险高，且跨环境行为不可控。

### Decision 2: 双模板模式并存（Legacy Placeholder + BBT-Lite）

选择：

- 输入值先做模板类型识别：
  - 若匹配 legacy 语法（`{author}` 风格），走现有替换逻辑；
  - 否则按 BBT-Lite 语法解析执行。

原因：

- 保持已有配置与测试稳定，避免破坏当前用户。
- 降低迁移成本，允许渐进切换。

备选方案：

- 全量切换到 BBT-Lite，不再支持旧模板。  
未选原因：兼容性风险高，属于破坏性变更。

### Decision 3: Auth/Year/Title 对象方法采用“方法表驱动”

选择：

- 为 `auth/year/title` 分别定义方法映射（method registry），链式调用按顺序执行：
  - 输入为 reference 元数据标准化 token；
  - 每个方法纯函数变换并返回新 token/value；
  - 参数方法（如 `select(n,m)`）做参数合法性检查。

原因：

- 易扩展、易测试、可追踪错误位置。
- 能逐步覆盖 BBT 常用方法而不污染主流程代码。

备选方案：

- 在单个函数中硬编码全部方法分支。  
未选原因：可维护性差，后续扩展成本高。

### Decision 4: 失败安全策略保持“预测失败不阻断”

选择：

- BBT-Lite 解析失败、方法不支持、字段缺失或结果为空时：
  - 当前条目预测 CiteKey 视为未命中；
  - 继续执行评分匹配兜底；
  - 不抛出中断错误。

原因：

- 与现有 workflow 行为一致，确保稳定性优先。

备选方案：

- 解析失败即任务失败。  
未选原因：会放大模板配置问题导致批处理中断，不符合当前产品语义。

### Decision 5: Workflow Settings 校验从“强语法拒绝”升级为“可识别即接受”

选择：

- settings 层校验支持两类合法模板：
  - legacy placeholder
  - BBT-Lite 语法
- 非法值继续回退到最近有效值或默认值。

原因：

- 保持已有失败安全约束，同时允许 BBT-Lite 正常保存与生效。

备选方案：

- settings 层不做校验，运行时再报错。  
未选原因：错误发现太晚，用户反馈差。

## Risks / Trade-offs

- [BBT-Lite 与真实 BBT 边界不完全一致] -> 在文档中明确支持范围，并以测试固化行为。
- [方法覆盖范围过大导致实现复杂] -> 采用方法表分层，先覆盖 Auth/Year/Title 对象方法，其他对象显式不支持。
- [表达式解析性能开销] -> 解析结果做模板级缓存（按模板字符串缓存 AST）。
- [字段缺失导致预测值不稳定] -> 统一空值语义，预测失败回退评分路径。

## Migration Plan

1. 扩展设置校验与运行时模板识别，保证旧模板继续可用。
2. 实现 BBT-Lite 解析器（Tokenizer + Parser + Evaluator）与方法表。
3. 将预测 CiteKey 生成接入现有“CiteKey 优先”主流程。
4. 增加测试：表达式成功命中、字段缺失、非法语法、方法不支持、回退评分。
5. 更新文档与示例，给出可用模板与不支持能力说明。
6. 若出现线上异常，回滚到仅 legacy 模式（保留旧逻辑开关）。

## Open Questions

- Auth/Year/Title 各对象“方法全集”以哪一版 BBT 文档为准（需要在 specs 中固化方法清单）。
- 是否在匹配结果中增加 `match_source`（explicit/predicted/scored）用于调试可观测性。
