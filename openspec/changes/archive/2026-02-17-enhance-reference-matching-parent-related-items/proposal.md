## Why

当前 `reference-matching` workflow 只在 references note 内回填 citekey。  
即使匹配成功，也不会把命中的库内条目写入到 references note 对应父条目的“关联引用”中，导致：

- 父条目层面的引用关系不完整，无法直接复用 Zotero 关联能力；
- 重复执行 workflow 时，无法以“已关联关系”为稳定状态进行幂等收敛。

## What Changes

- 增强 `reference-matching` 的 `applyResult`：在匹配并回填 citekey 后，收集命中条目并写入父条目关联引用。
- 关联写入基于父条目维度执行，不对 note 自身建立关联关系。
- 增加幂等约束：已存在关联不重复添加，重复执行结果稳定。
- 增加失败与降级语义：无父条目、无命中、候选无 itemKey 等场景不抛出破坏性错误。

## Capabilities

### Modified Capabilities

- `reference-matching-workflow`：
  - 从“仅回填 citekey 到 references note”
  - 扩展为“回填 citekey + 父条目关联引用更新（幂等）”。

## Impact

- `workflows/reference-matching/hooks/applyResult.js`：增加父条目关联写入与幂等去重逻辑。
- `test/workflow-reference-matching/*.test.ts`：新增/修改用例覆盖父条目关联更新与重复执行稳定性。
- OpenSpec：更新 `reference-matching-workflow` 增量规范与实现任务。
