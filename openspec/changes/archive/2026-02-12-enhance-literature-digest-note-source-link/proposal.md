## Why

当前 `literature-digest` workflow 回写的 digest note 不包含可稳定定位输入 markdown 附件的结构化标识，导致 Obsidian 侧模板需要依赖路径推断，跨机器与跨平台可移植性差。  
需要在 note 中增加“对 Zotero 友好且对 Obsidian 可读取”的来源标识字段。

## What Changes

- 新增 digest note 的隐藏来源元数据块，不在 Zotero 编辑界面中显示可见文本。
- 元数据块写入输入 markdown 附件的 `itemKey`，不写绝对路径或相对路径。
- 保持现有 digest note 的正文渲染与 `digest-markdown` payload 结构不变。
- 对无法解析输入 markdown 附件 `itemKey` 的场景定义安全降级：不中断本次 digest/references 回写。

## Capabilities

### New Capabilities

- `literature-digest-note-source-link`: digest note 在回写时输出隐藏来源元数据，并记录输入 markdown 附件 `itemKey`，供外部模板系统读取。

### Modified Capabilities

- （无）

## Impact

- `workflows/literature-digest/hooks/applyResult.js`：组装 digest note 时新增隐藏来源元数据块与 `itemKey` 写入逻辑。
- `test/zotero/21-workflow-literature-digest.test.ts`：新增/更新断言，验证来源元数据块存在且包含正确 `itemKey`。
- `test/zotero/50-workflow-literature-digest-mock-e2e.test.ts`：补充端到端回写结果检查。
- OpenSpec：新增 `literature-digest-note-source-link` capability 规格与任务。
