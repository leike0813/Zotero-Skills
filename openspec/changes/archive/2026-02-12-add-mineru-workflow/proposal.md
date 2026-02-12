## Why

当前插件缺少一个面向 PDF 解析的通用 workflow，无法把本地 PDF 批量送入 MinerU API 并自动回写解析产物到 Zotero 条目。现在正好可借此补齐 `mineru` workflow，同时扩展 `generic-http` provider 的多步 HTTP 能力，避免把多阶段网络流程硬编码到单个 workflow hook 中。

## What Changes

- 新增 `mineru` workflow，输入为 PDF 附件；支持直接选 PDF 和选父条目自动展开 PDF。
- 明确执行单元规则：每个 PDF 附件独立成一个任务，不打包。
- 在输入阶段增加目标冲突预过滤：仅当目标目录已存在同名 `.md` 文件时，该 PDF 直接跳过。
- 扩展 `generic-http` provider 与声明式请求编译器，支持 `generic-http.steps.v1` 多步 HTTP 请求。
- `mineru` workflow 以声明式 `steps` 调用 MinerU 推荐 API 路线（申请上传 URL -> 上传文件 -> 轮询结果 -> 下载 zip）。
- `applyResult` 负责 bundle 解包与产物落盘：`full.md` 重命名为 `<pdfBaseName>.md`，`images` 重命名为 `Images_<itemKey>`，并改写 markdown 内图片路径后回写为父条目链接附件；若存在同名孤立 `Images_<itemKey>` 目录且目标 `.md` 不存在，则先删除旧目录再落新目录。
- 鉴权统一走 Backend Profile：`auth.kind=bearer`，workflow 不暴露 token 参数。

## Capabilities

### New Capabilities

- `mineru-workflow-input-routing`: 定义 mineru workflow 的 PDF 输入合法性、父条目展开、每 PDF 一任务以及冲突预过滤语义。
- `mineru-workflow-http-pipeline`: 定义 mineru workflow 的声明式 steps HTTP 执行链路与 MinerU API 交互约束。
- `mineru-workflow-result-materialization`: 定义 MinerU bundle 的解包、重命名、路径改写、落盘和 Zotero 附件回写行为。
- `generic-http-provider-http-steps`: 定义 generic-http provider 的 `generic-http.steps.v1` 运行语义与错误语义。

### Modified Capabilities

- None.

## Impact

- `workflows/mineru/workflow.json`：新增 workflow 声明，采用 `generic-http.steps.v1`。
- `workflows/mineru/hooks/filterInputs.js`：实现 PDF 输入路由与“仅 `.md` 冲突”的预过滤。
- `workflows/mineru/hooks/applyResult.js`：实现 bundle 解包、重命名、路径改写与附件回写。
- `src/providers/contracts.ts`：新增 `generic-http.steps.v1` 请求合同。
- `src/workflows/types.ts` 与 `src/workflows/declarativeRequestCompiler.ts`：支持声明式 steps 请求构建。
- `src/providers/generic-http/provider.ts`：实现 steps 执行（json/upload/poll/download）并应用 backend bearer/default headers。
- `test/zotero/*` 与 `test/fixtures/mineru/*`：新增输入路由、steps 流程、结果落盘及失败路径测试。
- `doc/components/workflows.md`、`doc/components/providers.md`：更新能力说明。
