# reference-matching-workflow Specification

## Purpose
TBD - created by archiving change add-reference-matching-workflow. Update Purpose after archive.
## Requirements
### Requirement: 系统必须提供 reference-matching workflow
系统 MUST 提供一个基于 `pass-through` provider 的 workflow，用于处理 references 笔记中的参考文献匹配与回写。

#### Scenario: Workflow 执行入口
- **WHEN** 用户在 Zotero 中执行 reference-matching workflow
- **THEN** workflow 使用 `pass-through` provider 本地执行
- **AND** 不依赖远端后端请求

### Requirement: Workflow 必须仅接受 literature-digest references 笔记作为合法输入
系统 MUST 在 `filterInputs` 阶段拒绝非 references 笔记，避免误处理普通笔记或其他条目。

#### Scenario: 合法 references 输入
- **WHEN** 选中笔记包含 `data-zs-note-kind="references"` 或 `data-zs-payload="references-json"`
- **THEN** 该输入被保留并进入 applyResult

#### Scenario: 非法输入
- **WHEN** 选中项不是 references 笔记
- **THEN** 该输入被过滤
- **AND** workflow 不执行匹配回写

### Requirement: 系统必须可解码 references payload 并恢复结构化 JSON
系统 MUST 从 references 笔记中解析 payload block，完成解码并获取原始参考文献 JSON 结构。

#### Scenario: 成功解码 payload
- **WHEN** payload block 存在且编码合法
- **THEN** 系统得到可迭代的 references 列表用于匹配

#### Scenario: payload 异常
- **WHEN** payload 缺失、编码损坏或 JSON 非法
- **THEN** 系统终止当前输入处理并返回明确错误
- **AND** 不写入部分回填结果

### Requirement: 系统必须为每条参考文献执行高置信匹配并回填 citekey
系统 MUST 对每条参考文献执行库内匹配，匹配成功后将对应文献的 `citekey` 写回结构化 JSON，并同步更新 HTML 表格对应列。

#### Scenario: 标题完全匹配
- **WHEN** 参考文献标题与库内条目标题归一化后完全一致
- **THEN** 该候选被视为高优先级命中
- **AND** 系统回填 citekey

#### Scenario: 边界场景模糊匹配
- **WHEN** 标题不完全一致但标题近似，且作者或年份可提供辅助证据
- **THEN** 系统按评分阈值决定是否命中
- **AND** 标题证据仍为主要判定依据

#### Scenario: 低置信或多冲突候选
- **WHEN** 候选分数不足或存在不可判定冲突
- **THEN** 系统不回填 citekey
- **AND** 保留原始参考文献数据不被误写

### Requirement: 系统必须覆盖回写 references 笔记并保持既有格式骨架
系统 MUST 在匹配完成后覆盖回写该 notes 内容，同时保持原有外层结构与头部语义（如 note-kind 与 payload block 形态）不被破坏。

#### Scenario: 回写完成
- **WHEN** 本次匹配处理结束
- **THEN** 笔记中 payload JSON 与 HTML 表格均反映最新 citekey
- **AND** 文件头与结构化容器保持兼容

### Requirement: 系统必须支持可试错的数据源策略并在关键分歧处请求决策
系统 MUST 优先尝试 Zotero JavaScript API 进行全库匹配；若不可满足要求，可回退 Better BibTeX JSON 接口。遇到无法自动抉择的关键分歧时，agent MUST 反馈并请求用户决策。

#### Scenario: Zotero API 可用
- **WHEN** Zotero JavaScript API 可完成全库匹配需求
- **THEN** 系统优先使用该路径

#### Scenario: Zotero API 不可满足
- **WHEN** 实现验证确认 Zotero API 路径不可满足稳定性或性能要求
- **THEN** 系统切换到 Better BibTeX JSON 路径
- **AND** 记录切换原因

#### Scenario: 分歧无法自动决策
- **WHEN** 两条路径均有显著权衡且无明确最优
- **THEN** agent 向用户反馈现状并请求决策后再继续实现

