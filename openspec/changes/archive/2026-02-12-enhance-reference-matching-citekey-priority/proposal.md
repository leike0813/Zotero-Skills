## Why

当前 `reference-matching` 主要依赖 `title/author/year` 评分，在个别元数据边界场景下会出现漏匹配。为提高稳定性，需要引入“CiteKey 优先”路径：先尝试精确 CiteKey 命中，再回退到现有相似度匹配。

## What Changes

- 在 `reference-matching` 中新增“CiteKey 最高优先级短路”策略：当参考文献与库内条目发生 CiteKey 精确命中时，直接写入并结束该条匹配流程。
- 为参考文献条目增加“内部 CiteKey 预测”步骤：按可配置模板生成候选 CiteKey，并优先用于精确匹配尝试。
- 在 Workflow Settings 为 `reference-matching` 增加 CiteKey 模板配置项；默认值对齐 Better BibTeX 默认模板语义。
- 保留并后置现有 `title/author/year` 评分匹配作为兜底，确保兼容已有行为。
- 补充测试与文档，覆盖优先级、模板配置、短路与回退路径。

## Capabilities

### New Capabilities

- `reference-matching-citekey-priority`: 定义 CiteKey 精确命中优先级、短路规则与回退顺序。
- `reference-matching-citekey-template`: 定义内部 CiteKey 预测模板的工作流参数与 Workflow Settings 配置语义（含默认值约束）。

### Modified Capabilities

- （无）

## Impact

- `workflows/reference-matching/workflow.json`：新增 CiteKey 模板相关参数声明与默认值。
- `workflows/reference-matching/hooks/applyResult.js`：实现 CiteKey 优先匹配、内部 CiteKey 预测与短路流程。
- `src/modules/workflowSettings.ts`（及设置对话框相关路径）：支持 `reference-matching` 的 CiteKey 模板参数读写。
- `test/zotero/24-workflow-reference-matching.test.ts`：新增优先级短路、模板可配置与回退路径用例。
- `doc/components/workflows.md`：更新 `reference-matching` 匹配顺序与参数说明。
