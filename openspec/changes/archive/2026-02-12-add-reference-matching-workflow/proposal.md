## Why

当前已经有 `literature-digest` workflow 产出 `references` 笔记，但还缺少“把参考文献条目回连到库内条目（citekey）”的自动化流程。  
这导致引用映射需要手工完成，且无法稳定复用到后续引用导出或标签治理流程。

## What Changes

- 新增一个基于 `pass-through` provider 的 `reference-matching` workflow。
- workflow 仅接受 `literature-digest` 生成的 `references` 笔记作为合法输入。
- 在 `applyResult` 中读取并解码笔记 payload，提取参考文献 JSON。
- 对每条参考文献执行“库内匹配 -> 回填 citekey”流程，并同步更新笔记内 HTML 表格。
- 覆盖回写原笔记内容，但保持既有外层结构与文件头约定不被破坏。
- 将“全库匹配数据源”设计为可试错策略：优先 Zotero JavaScript API，不可行时回退 Better BibTeX JSON 接口。

## Capabilities

### New Capabilities

- `reference-matching-workflow`: 以 references 笔记为输入，完成 payload 解码、文献匹配、citekey 回填与笔记覆盖回写。

### Modified Capabilities

- （无）

## Impact

- `workflows/`：新增 `reference-matching` workflow 目录、manifest 与 hooks。
- `workflows/reference-matching/hooks/filterInputs.js`：输入合法性检查（仅 references 笔记）。
- `workflows/reference-matching/hooks/applyResult.js`：payload 解码、匹配、回写主流程。
- `test/zotero/`：新增 workflow 端到端与匹配策略测试（TDD）。
- `doc/components/`：补充该 workflow 的输入约束、匹配规则与失败语义说明。
- OpenSpec：新增 `reference-matching-workflow` capability 规范与实现任务。

