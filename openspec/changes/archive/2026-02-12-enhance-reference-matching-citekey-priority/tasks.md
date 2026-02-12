## 1. CiteKey 优先匹配主流程（TDD）

- [x] 1.1 先编写测试：reference 中显式 `citekey/citeKey` 命中时直接回写并短路，不进入评分匹配
- [x] 1.2 先编写测试：显式 CiteKey 未命中时，流程会继续进入预测 CiteKey 与评分兜底
- [x] 1.3 实现 `applyResult` 中的“显式 CiteKey 精确匹配 -> 命中短路”逻辑
- [x] 1.4 实现 CiteKey 命中歧义处理（同 key 多候选不直接写入并回退下一阶段）

## 2. 内部 CiteKey 预测与模板引擎（TDD）

- [x] 2.1 先编写测试：默认模板可基于 `author/year/title` 生成稳定预测 CiteKey
- [x] 2.2 先编写测试：用户自定义模板生效并覆盖默认模板
- [x] 2.3 先编写测试：reference 字段缺失时模板引擎安全降级且不中断 workflow
- [x] 2.4 实现模板占位符替换与规范化（至少支持 `{author}`、`{year}`、`{title}`）
- [x] 2.5 实现“预测 CiteKey 精确匹配 -> 命中短路”逻辑

## 3. Workflow Settings 参数接入与容错（TDD）

- [x] 3.1 先编写测试：`reference-matching` 可读取/保存 `citekey_template` 参数
- [x] 3.2 先编写测试：非法模板值（空串/不可解析）被拒绝并回退最近有效值或默认值
- [x] 3.3 在 `workflows/reference-matching/workflow.json` 声明 `citekey_template` 参数与默认值
- [x] 3.4 在 `src/modules/workflowSettings.ts`（及设置流）实现模板参数归一化与持久化

## 4. 评分兜底兼容与回归（TDD）

- [x] 4.1 先编写测试：CiteKey 阶段失败/歧义时保留现有 `title/author/year` 评分兜底能力
- [x] 4.2 先编写测试：CiteKey 阶段与评分阶段都失败时不写入 citekey
- [x] 4.3 实现候选 CiteKey 索引构建，避免重复线性扫描
- [x] 4.4 校验 payload JSON 与 HTML 表格 citekey 列在新流程下持续同步

## 5. 验证与文档

- [x] 5.1 更新 `doc/components/workflows.md`（匹配顺序、模板参数、短路与回退语义）
- [x] 5.2 执行 `npm run build`
- [x] 5.3 执行 `npm run test:node:full`
