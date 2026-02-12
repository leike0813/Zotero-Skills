## Why

`mineru` workflow 当前的同名 `.md` 幂等判定在真实使用中存在漏判，导致已存在结果文件的 PDF 仍会进入执行链路，并在父条目下重复创建同一路径 `.md` 的链接附件。该问题直接破坏幂等性与结果可追溯性，需要优先修复。

## What Changes

- 修复 `mineru` 输入过滤逻辑：在触发入口严格识别“同目录同名 `.md` 已存在”的 PDF，并在提交 job 前剔除。
- 明确触发语义：
  - 若本次选择中的 PDF 全部命中同名 `.md`，workflow 不应进入执行；
  - 若仅部分命中，则仅提交未命中的 PDF。
- 明确反馈语义：触发结束后应报告被剔除/跳过的数量（`skipped`）。
- 增加防御性约束：即便入口过滤失效，结果回写阶段也不得为同一父条目重复链接同一路径 `.md`。

## Capabilities

### New Capabilities

- `mineru-idempotent-input-filtering`: 定义 mineru 在输入阶段的同名 `.md` 冲突判定、全量阻断与部分剔除语义。
- `mineru-skipped-input-reporting`: 定义 mineru 在执行结果中的 `skipped` 反馈语义以及重复 `.md` 链接防御约束。

### Modified Capabilities

- None.

## Impact

- `workflows/mineru/hooks/filterInputs.js`：修复同名 `.md` 检测与输入剔除。
- `src/workflows/runtime.ts` / `src/modules/workflowExecute.ts`：补齐“全量被过滤时”的可报告 skipped 语义（若当前统计不足）。
- `workflows/mineru/hooks/applyResult.js`：补充重复链接防御（同父条目同路径 `.md` 不重复添加）。
- `test/zotero/39-workflow-mineru.test.ts`：新增/调整幂等过滤与 skipped 报告测试。
- 相关文档：更新 mineru workflow 行为说明与边界条件。

