## Why

当前 `reference-matching` 的 `citekey_template` 仅支持 `{author}/{title}/{year}` 占位符，无法解析 Better BibTeX 的公式风格表达式（如 `auth.lower + ...`），导致用户已配置的 BBT 规则无法直接复用，CiteKey 预测命中率受限。现在需要引入 BBT-Lite 兼容层，在可控范围内支持 Auth/Year/Title 对象方法，提升与现有 BBT 工作流的一致性。

## What Changes

- 为 `reference-matching` 的 `citekey_template` 增加 BBT-Lite 表达式兼容能力，支持字符串拼接与 Auth/Year/Title 三类对象的常用链式方法。
- 保留现有简化模板的兼容性（`{author}_{title}_{year}` 及同类写法继续可用），避免对已有配置造成破坏。
- 增加模板解析失败与方法不支持时的容错策略，确保 workflow 不崩溃并可回退评分匹配逻辑。
- 扩展测试覆盖：BBT-Lite 模板成功命中、非法表达式回退、字段缺失降级、与评分兜底协同等场景。
- 更新工作流文档，明确 BBT-Lite 支持边界（仅 Auth/Year/Title 相关对象与方法，不完整复刻 BBT 引擎）。

## Capabilities

### New Capabilities

- `reference-matching-bbt-lite-template`: 在 reference-matching 中提供 BBT-Lite CiteKey 模板解析与预测能力，覆盖 Auth/Year/Title 对象方法与回退语义。

### Modified Capabilities

- None.

## Impact

- `workflows/reference-matching/hooks/applyResult.js`：新增 BBT-Lite 表达式解析/执行与预测 CiteKey 生成逻辑。
- `src/modules/workflowSettings.ts`：调整模板合法性校验，支持 BBT-Lite 语法输入并保持失败安全。
- `workflows/reference-matching/workflow.json`：参数说明更新（语义从“占位符模板”扩展为“占位符 + BBT-Lite 表达式”）。
- `test/zotero/24-workflow-reference-matching.test.ts` 与 `test/zotero/35-workflow-settings-execution.test.ts`：新增/更新 BBT-Lite 相关测试。
- `doc/components/workflows.md`：补充 BBT-Lite 支持范围、非目标范围与回退行为说明。
