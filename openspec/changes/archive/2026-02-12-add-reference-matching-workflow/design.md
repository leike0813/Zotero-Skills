## Context

本项目已经具备：

- `literature-digest` 生成 digest/references 笔记（含 payload）
- `pass-through` provider 允许本地纯代码执行并回写结果

新增“文献匹配”workflow 的关键点不是远端调用，而是本地数据对齐：

1. 从 references 笔记提取结构化参考文献数据  
2. 在当前 Zotero 库中寻找最可信匹配  
3. 将 `citekey` 同时回填到 payload JSON 与可视化 HTML 表格  
4. 覆盖回写笔记并保持原有格式约定

## Goals / Non-Goals

**Goals:**

- 使用 `pass-through` provider 落地本地匹配 workflow。
- 只接受合法 references 笔记输入，避免误处理普通笔记。
- 形成可解释的匹配评分规则，且以标题证据为主。
- 在匹配失败或低置信时保持安全降级（不误填 citekey）。
- 支持实现期试错，并在关键分歧处向用户询问决策。

**Non-Goals:**

- 不修改 `literature-digest` 产出格式规范。
- 不引入远端后端依赖。
- 不在本 change 中实现复杂机器学习匹配器。

## Decisions

### Decision 1: Workflow 执行模型

- 采用 `pass-through` provider。
- `filterInputs` 负责输入合法性过滤（references note only）。
- `applyResult` 负责全部业务处理（解码、匹配、回填、回写）。

### Decision 2: 合法输入定义

references 笔记必须满足以下至少一组标记：

- `data-zs-note-kind="references"`  
- 或 payload 标识 `data-zs-payload="references-json"`

不满足则过滤并返回空执行单元。

### Decision 3: 匹配数据源策略（可试错）

采用分层策略：

1. 首选：Zotero JavaScript API 全库检索/遍历（本地、无外部依赖）  
2. 备选：Better BibTeX JSON 接口（当首选方案在性能或可用性上不可满足）  

若实现阶段确认两者都存在明显局限，agent 必须反馈并请求用户决策后再继续。

### Decision 4: 匹配评分策略

采用“标题主导 + 作者/年份辅助”的高置信策略：

- 标题完全匹配：最高优先级，可直接判定高置信命中
- 标题归一化近似匹配：仅作为补充，需作者/年份至少一项共同支持
- 作者与年份仅用于加权，不得在标题证据弱时单独决定命中
- 对多候选冲突或低于阈值场景，不回填 citekey

### Decision 5: 回写策略

- 覆盖回写当前 references 笔记内容
- 保留既有外层结构与头部语义（如 `data-zs-note-kind`、payload block 结构）
- 同步更新：
  - payload JSON 中每条参考文献的 `citekey`
  - HTML 表格对应 `Citekey` 列

## Risks / Trade-offs

- 全库遍历性能风险：先确保正确性，再通过缓存/索引优化。
- 元数据噪声导致误匹配风险：采用高阈值，宁可漏配不误配。
- 不同来源元数据格式差异：通过归一化（大小写、标点、空白）缓解。
- 数据源切换复杂度：通过适配层隔离 Zotero API 与 BBT JSON 读取路径。

## Migration Plan

1. 增加 workflow scaffold 与 manifest（pass-through）。
2. 先写测试：合法输入识别、payload 解码、匹配评分、回写一致性。
3. 实现 `filterInputs` 与 `applyResult`。
4. 引入匹配数据源适配层（先 Zotero API，保留 BBT fallback 位点）。
5. 完成端到端验证并补文档。

## Open Questions

- 若 Zotero API 与 BBT JSON 同时可用，是否需要配置开关强制指定数据源？
- 对“多个高分候选”是否需要人工确认模式（本 change 默认不启用）？
- 匹配结果是否需要额外回写置信分数（本 change 默认不写入）？

