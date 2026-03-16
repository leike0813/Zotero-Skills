# literature-explainer-workflow Specification

## Purpose
TBD - created by archiving change add-literature-explainer-workflow. Update Purpose after archive.
## Requirements
### Requirement: 系统 MUST 提供 literature-explainer workflow
系统 MUST 提供一个 `literature-explainer` workflow，并通过 `skillrunner.job.v1` 调用同名 SkillRunner skill，执行模式为 `interactive`。

#### Scenario: Workflow manifest 可加载
- **WHEN** workflow loader 扫描 `workflows/literature-explainer`
- **THEN** 系统 MUST 成功加载 `id=literature-explainer` 的 manifest
- **AND** request kind MUST 为 `skillrunner.job.v1`
- **AND** skill id MUST 为 `literature-explainer`
- **AND** execution `skillrunner_mode` MUST 为 `interactive`

### Requirement: Workflow 输入路由 MUST 遵循 Markdown 优先策略
系统 MUST 在每个父条目上仅选择一个输入文件，并按既定规则决策：Markdown 优先；多个 Markdown 时优先匹配“最早 PDF 同名 Markdown”；无匹配回退最早 Markdown；无 Markdown 时回退 PDF（单一 PDF 直接使用，多 PDF 取最早）。

#### Scenario: 单一 Markdown 优先
- **WHEN** 某父条目存在单一 Markdown（可同时存在 PDF）
- **THEN** workflow MUST 选择该 Markdown 作为 `source_path`

#### Scenario: 多 Markdown + PDF 时按最早 PDF 同名匹配
- **WHEN** 某父条目存在多个 Markdown 且存在 PDF
- **THEN** workflow MUST 先找到最早加入的 PDF
- **AND** 若存在同 stem Markdown，MUST 选择该 Markdown

#### Scenario: 多 Markdown 且无可匹配 PDF 时回退最早 Markdown
- **WHEN** 多 Markdown 场景下不存在可匹配的 PDF 同名 Markdown
- **THEN** workflow MUST 选择最早加入的 Markdown

#### Scenario: 无 Markdown 时回退 PDF
- **WHEN** 某父条目无 Markdown 且有 PDF
- **THEN** 单一 PDF MUST 直接被选中
- **AND** 多 PDF MUST 选择最早加入的 PDF

### Requirement: Workflow 结果应用 MUST 仅在 note_path 可用时创建笔记
系统 MUST 在后端成功后读取输出 `note_path`。仅当 `note_path` 非空且文件存在时创建 note；否则 MUST 跳过 note 创建且不将该情况视为任务失败。

#### Scenario: note_path 有效时创建笔记
- **WHEN** `result/result.json`（或等价运行结果）提供可读 `note_path`
- **THEN** workflow MUST 创建一条父条目子 note
- **AND** note 标题 MUST 为 `Conversation Note yymmddhhmm`
- **AND** note 正文 MUST 包含 Markdown 渲染 HTML 与原始 Markdown 隐藏 payload

#### Scenario: note_path 为空或不存在时跳过笔记创建
- **WHEN** `note_path` 为空字符串或指向的文件不存在
- **THEN** workflow MUST 跳过 note 创建
- **AND** workflow MUST NOT 将该分支视为 apply 失败

### Requirement: literature-explainer workflow MUST 为非幂等 note 写入
系统 MUST 将每次有效 `note_path` 结果视为一次新的 note 产出，不进行同类 note 的更新、覆盖或去重。

#### Scenario: 重复执行同一输入
- **WHEN** 用户对同一父条目重复成功执行 workflow 且每次都有有效 `note_path`
- **THEN** workflow MUST 每次新增一条 note
- **AND** MUST NOT 复用或删除既有 note

