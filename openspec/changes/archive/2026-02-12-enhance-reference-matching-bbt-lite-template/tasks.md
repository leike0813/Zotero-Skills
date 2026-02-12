## 1. BBT-Lite 模板解析与执行骨架（TDD）

- [x] 1.1 先编写测试：`citekey_template` 为合法 BBT-Lite 表达式时可被识别并执行
- [x] 1.2 先编写测试：仅允许 `auth/year/title` 对象、字符串字面量与 `+` 拼接
- [x] 1.3 在 `workflows/reference-matching/hooks/applyResult.js` 新增 BBT-Lite tokenizer/parser/evaluator 骨架（无 `eval`）
- [x] 1.4 实现 AST 缓存（按模板字符串缓存）并接入预测 CiteKey 生成路径

## 2. Auth/Year/Title 方法兼容层（TDD）

- [x] 2.1 先编写测试：`auth` 对象方法链在固定输入下产生稳定输出
- [x] 2.2 先编写测试：`title` 对象方法链（含 `nopunct/skipwords/select` 组合）可复现预期输出
- [x] 2.3 先编写测试：`year` 对象方法在日期/年份字段下有稳定归一化行为
- [x] 2.4 实现 `auth/year/title` 方法表（method registry）与链式调用执行器
- [x] 2.5 实现方法参数校验与非法调用错误归一化（供失败安全回退使用）

## 3. 双语法兼容与设置层容错（TDD）

- [x] 3.1 先编写测试：legacy 占位符模板（如 `{author}_{title}_{year}`）保持向后兼容
- [x] 3.2 先编写测试：BBT-Lite 模板在 Workflow Settings 可保存并生效
- [x] 3.3 先编写测试：非法模板值在保存/加载阶段回退到最近有效值或默认值
- [x] 3.4 在 `src/modules/workflowSettings.ts` 扩展模板合法性判定（legacy + BBT-Lite）
- [x] 3.5 在 `workflows/reference-matching/workflow.json` 更新参数语义说明（兼容双语法）

## 4. 失败安全与匹配主流程回归（TDD）

- [x] 4.1 先编写测试：BBT-Lite 解析失败时不崩溃并回退评分匹配
- [x] 4.2 先编写测试：对象/方法不支持时不崩溃并回退评分匹配
- [x] 4.3 先编写测试：字段缺失导致预测值为空时仍可继续评分兜底
- [x] 4.4 在 `applyResult` 中接入失败安全分支，确保“显式 -> 预测 -> 评分”顺序不变
- [x] 4.5 回归校验 payload JSON 与 HTML 表格 citekey 列持续同步

## 5. 文档与验证

- [x] 5.1 更新 `doc/components/workflows.md`（BBT-Lite 支持范围、非目标范围、回退语义）
- [x] 5.2 补充/更新测试说明文档（如有）以覆盖 BBT-Lite 案例
- [x] 5.3 执行 `npm run build`
- [x] 5.4 执行 `npm run test:node:full`
