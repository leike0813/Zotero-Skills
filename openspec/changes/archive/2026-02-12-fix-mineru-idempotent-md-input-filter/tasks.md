## 1. MinerU 输入幂等过滤修复（TDD）

- [x] 1.1 先编写测试：当所有候选 PDF 均已存在同名 `.md` 时，`mineru` 不生成任何请求且不可执行
- [x] 1.2 先编写测试：多 PDF 混合输入时，仅保留无冲突 PDF 进入请求集合
- [x] 1.3 修复 `workflows/mineru/hooks/filterInputs.js` 的同名 `.md` 判定与输入剔除逻辑

## 2. 跳过统计与执行反馈修复（TDD）

- [x] 2.1 先编写测试：部分冲突时执行总结正确报告 `skipped` 数量
- [x] 2.2 先编写测试：全量冲突时执行不提交 job 且 `skipped` 等于候选输入总数
- [x] 2.3 修复 `src/workflows/runtime.ts` / `src/modules/workflowExecute.ts` 的全量过滤统计传递与显示

## 3. 回写防御：避免重复链接附件（TDD）

- [x] 3.1 先编写测试：同一父条目已存在同路径 `.md` 附件时，`applyResult` 不重复创建链接
- [x] 3.2 修改 `workflows/mineru/hooks/applyResult.js` 增加同路径附件去重防线

## 4. 回归验证

- [x] 4.1 执行 `npm run build`
- [x] 4.2 执行 `npm run test:node:full`
- [x] 4.3 更新相关文档（`doc/components/workflows.md` 中 mineru 幂等与 skipped 语义）
