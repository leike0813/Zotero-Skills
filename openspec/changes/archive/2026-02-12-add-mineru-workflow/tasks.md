## 1. OpenSpec 文档与契约固化

- [x] 1.1 完成 `proposal.md`，明确 mineru workflow 与 generic-http steps 扩展目标
- [x] 1.2 完成 `design.md`，确认 API 路线、鉴权来源与“仅 `.md` 冲突预过滤 + images 替换”语义
- [x] 1.3 完成四份 capability 规格：input-routing / http-pipeline / result-materialization / provider-http-steps

## 2. Generic HTTP Steps 能力实现（TDD）

- [x] 2.1 先编写测试：`generic-http.steps.v1` 能被 provider registry 正确解析并执行
- [x] 2.2 先编写测试：steps 顺序执行、变量提取与插值可用
- [x] 2.3 先编写测试：poll step 成功/失败/超时语义
- [x] 2.4 先编写测试：binary upload/download steps 行为正确
- [x] 2.5 修改 `src/providers/contracts.ts`、`src/workflows/types.ts`、`src/workflows/declarativeRequestCompiler.ts`、`src/providers/generic-http/provider.ts`
- [x] 2.6 回归测试：`generic-http.request.v1` 既有用例不回归

## 3. MinerU Workflow 输入与请求（TDD）

- [x] 3.1 先编写测试：直接选 PDF 时一附件一任务
- [x] 3.2 先编写测试：选父条目时按子 PDF 展开并一附件一任务
- [x] 3.3 先编写测试：目标目录存在同名 `.md` 时输入被过滤
- [x] 3.4 先编写测试：仅存在 `Images_<itemKey>` 而无同名 `.md` 时输入不被过滤
- [x] 3.5 新增 `workflows/mineru/workflow.json`（声明式 `generic-http.steps.v1`，无 `buildRequest.js`）
- [x] 3.6 新增 `workflows/mineru/hooks/filterInputs.js`

## 4. MinerU Bundle 结果处理与回写（TDD）

- [x] 4.1 先编写测试：`full.md` 重命名为 `<pdfBaseName>.md`
- [x] 4.2 先编写测试：`images` 重命名为 `Images_<itemKey>` 且 markdown 路径被替换
- [x] 4.3 先编写测试：仅存在同名孤立 `Images_<itemKey>` 时先删除旧目录再落新目录
- [x] 4.4 先编写测试：产物落到 PDF 同目录并作为父条目链接附件回写
- [x] 4.5 先编写测试：缺少关键 bundle entry 时单任务失败且不产生部分回写
- [x] 4.6 新增 `workflows/mineru/hooks/applyResult.js`

## 5. 回归验证与文档更新

- [x] 5.1 更新 `doc/components/providers.md`（`generic-http.steps.v1`）
- [x] 5.2 更新 `doc/components/workflows.md`（mineru workflow 行为）
- [x] 5.3 执行 `npm run build`
- [x] 5.4 执行 `npm run test:node:full`
