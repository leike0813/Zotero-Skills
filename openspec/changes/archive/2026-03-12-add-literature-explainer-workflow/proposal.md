## Why

`literature-explainer` skill 已在 Skill-Runner 后端可用，但插件侧还没有对应 workflow，导致用户无法在 Zotero 中直接发起论文交互式讲解流程并消费可选学习笔记产物。当前需要补齐前端 workflow，以对齐既有 `literature-digest` 输入路由策略并打通 note 落地。

## What Changes

- 新增 `literature-explainer` workflow（`provider=skillrunner`，`request.kind=skillrunner.job.v1`，`skillrunner_mode=interactive`）。
- 新增 `filterInputs`：父条目输入选择策略与 `literature-digest` 对齐（Markdown 优先，按最早 PDF 同名匹配与时间回退）。
- 新增 `applyResult`：消费 `note_path` 可选产物；仅当文件存在时创建笔记，否则静默跳过。
- 笔记创建为非幂等新增行为，每次成功 run 可新增一条 note。
- 笔记标题固定为 `Conversation Note yymmddhhmm`，正文采用 Markdown 原文隐藏 payload + HTML 渲染。

## Capabilities

### New Capabilities
- `literature-explainer-workflow`: 提供交互式论文讲解 workflow，含输入路由与可选 note 产物落地。

### Modified Capabilities
- （无）

## Impact

- 受影响代码：
  - `workflows/literature-explainer/**`
  - `test/workflow-literature-explainer/**`
- 受影响 OpenSpec：
  - `openspec/changes/add-literature-explainer-workflow/**`
