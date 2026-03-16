## Why

`tag-regulator` 当前 suggest-tags 分支仍是“勾选后提交/取消”，取消即丢弃，且未与 `tag-manager` staged inbox 闭环打通。  
这会导致建议标签在未即时确认时易丢失，也无法进入后续人工审阅流。

## What Changes

- 将 suggest-tags 对话流程改为“条目即时处理 + 全局动作 + 10 秒超时默认暂存”。
- 默认关闭语义改为 close=>`全部暂存`，不再取消即丢弃。
- 条目级新增 `加入`/`拒绝` 即时动作：  
  - `加入` 立即写入受控词表（`source=agent-suggest`）；校验失败保留并显示错误。  
  - `拒绝` 立即废弃并移除。  
- 全局动作改为 `全部加入` / `全部暂存` / `全部拒绝`。  
- 未确认剩余条目写入 staged 持久化（`tagVocabularyStagedJson`），并标记 `sourceFlow=tag-regulator-suggest`。
- 扩展 workflow editor host 合同：支持自定义全局按钮、`actionId` 回传、`closeActionId` 关闭默认动作。

## Capabilities

### Modified Capabilities

- `tag-regulator-workflow`
- `workflow-editor-host`
- `tag-vocabulary-management-workflow`

## Impact

- `workflows/tag-regulator/hooks/applyResult.js`
- `src/modules/workflowEditorHost.ts`
- `test/workflow-tag-regulator/64-workflow-tag-regulator.test.ts`
- `test/workflow-tag-regulator/65-workflow-tag-regulator-mock-e2e.test.ts`
- `test/ui/44-workflow-editor-host.test.ts`
