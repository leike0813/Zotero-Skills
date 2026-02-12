## 1. Workflow 骨架与输入约束（TDD）

- [x] 1.1 新增 `workflows/reference-matching/workflow.json`（provider=`pass-through`，最小 hooks 模式）
- [x] 1.2 先编写测试：仅 references 笔记可通过 `filterInputs`
- [x] 1.3 实现 `hooks/filterInputs.js`，拒绝非 references 输入

## 2. Payload 解码与结构恢复（TDD）

- [x] 2.1 先编写测试：可从 references note 中解析并解码 payload JSON
- [x] 2.2 实现 `hooks/applyResult.js` 的 payload 读取与解码流程
- [x] 2.3 编写失败路径测试：payload 缺失/损坏时应报错且不回写

## 3. 文献匹配核心逻辑（TDD）

- [x] 3.1 先编写测试：标题完全匹配优先并回填 citekey
- [x] 3.2 先编写测试：边界场景模糊匹配需标题主证据 + 作者/年份辅助
- [x] 3.3 实现匹配评分器与阈值策略（高置信优先，低置信不回填）
- [x] 3.4 先编写测试：多候选冲突或低分场景不写 citekey

## 4. 全库数据源策略与决策闸门

- [x] 4.1 实现 Zotero JavaScript API 全库检索/遍历路径（默认主路径）
- [x] 4.2 预留 Better BibTeX JSON 回退适配层与切换位点
- [x] 4.3 若实现期出现无法自动抉择的关键权衡，记录问题并向用户提问决策

## 5. 回写与格式保持（TDD）

- [x] 5.1 先编写测试：匹配后 payload JSON 与 HTML 表格 `citekey` 列同步更新
- [x] 5.2 先编写测试：覆盖回写后 note 头部/外层结构保持兼容
- [x] 5.3 实现覆盖回写流程并通过上述测试

## 6. 集成验证与文档

- [x] 6.1 新增 workflow 端到端测试：从 references note 输入到回写完成
- [x] 6.2 执行 `npm run build` 与 `npm run test:node:full`
- [x] 6.3 更新组件文档（workflow 输入约束、匹配规则、失败语义）
