## Context

项目已经有可运行的 workflow 引擎与 provider 架构，但 `generic-http` 当前只支持单请求模型（`generic-http.request.v1`）。MinerU 的推荐调用路径属于典型多阶段流程：先申请上传 URL，再上传文件，再轮询状态，最后下载结果 zip。若继续用单请求模型，会把流程编排挤进 workflow hook，导致 provider 抽象退化且不可复用。

此外，用户明确了三项决策：

1. 采用 MinerU 推荐 API 路线；
2. Token 走 Backend Profile `auth.kind=bearer`；
3. 若目标目录已有同名 `.md` 文件，在输入阶段直接过滤；`images` 目录不参与输入过滤。

## Goals / Non-Goals

**Goals:**

- 新增 `mineru` workflow，支持 PDF 输入和父条目展开。
- 扩展 `generic-http` 为可声明式编排多步 HTTP 请求的 provider。
- 以声明式方式完成 MinerU 调用链路，不为 mineru 单独复制 transport 框架。
- 保证输出产物可直接落到 PDF 同目录并自动挂到父条目。
- 在输入阶段避免 `.md` 覆盖式写盘风险，并在输出阶段处理孤立 images 目录冲突。

**Non-Goals:**

- 不引入新的 provider 类型（仍使用 `generic-http`）。
- 不在 workflow 参数中新增 token 或完整 endpoint URL。
- 不做“覆盖已有 `.md` 目标文件”的行为修复；`.md` 冲突统一前置跳过。
- 不在本 change 中引入 UI 侧专用 MinerU 设置页。

## Decisions

### Decision 1: 新增 `generic-http.steps.v1`，并保持单请求类型兼容

- 在 `contracts/types/compiler/provider` 中引入 `generic-http.steps.v1`。
- `generic-http.request.v1` 保持原语义不变，避免影响既有 workflow。
- steps 作为 provider 的通用能力，不写 mineru 特化分支。

备选方案：

- 仅给 mineru 写 `buildRequest.js` + 自定义网络调用。  
未选原因：重复实现 transport，且无法复用到后续 workflow。

### Decision 2: MinerU workflow 采用“声明式 steps + 两个 hooks”

- `filterInputs.js`：输入归一化与冲突预过滤。
- `applyResult.js`：bundle 结果处理与回写。
- 不使用 `buildRequest.js`，请求由声明式编译器生成。

备选方案：

- 继续使用 `buildRequest.js` 组织动态请求。  
未选原因：与“借此完善 generic-http 声明式能力”的目标冲突。

### Decision 3: 输入单元严格为“每 PDF 一任务”

- 直接选中的 PDF：一条 PDF 一任务。
- 选中父条目：按父条目下 PDF 附件展开后，一条 PDF 一任务。
- 任务不聚合，避免后续结果落盘与附件挂载时的上下文混淆。

### Decision 4: 冲突文件在输入阶段过滤

- 目标路径定义：
  - `<pdfDir>/<pdfBaseName>.md`（输入过滤依据）
  - `<pdfDir>/Images_<pdfItemKey>/`（输出阶段处理）
- 仅当同名 `.md` 已存在时，该 PDF 输入单元跳过，不进入请求执行。
- 运行结果中仅体现“跳过计数”，不对目标文件做覆盖。

### Decision 5: 孤立 images 目录在输出阶段可替换

- 当输入阶段判定可执行（即 `.md` 不存在）时，进入 `applyResult`。
- 若输出目标位置已存在同名 `Images_<pdfItemKey>` 目录，则先删除旧目录，再写入新的 images 目录。
- 删除动作仅作用于该固定命名目录，不扩展到其他路径。

### Decision 6: 鉴权与默认头统一由 backend 注入

- provider 执行 steps 时统一合并：
  - backend defaults headers
  - bearer token 头（若 `auth.kind=bearer`）
  - step/request 级 headers（可覆盖默认值）

## Risks / Trade-offs

- [MinerU 接口字段差异导致步骤解析失败] -> 在 steps 里提供路径提取与显式错误消息，测试覆盖主要返回形态。
- [上传 URL 失效或网络中断] -> 单任务失败隔离，不影响其他 PDF 任务执行。
- [轮询时间过长] -> 使用可配置的 `poll.interval_ms` / `poll.timeout_ms`；超时给出稳定错误。
- [本地文件系统路径差异（Win/macOS/Linux）] -> 路径拼接统一复用现有 `joinPath/getBaseName` 语义。
- [输入过滤导致“看似没执行”] -> 在工作流完成消息里保留 skipped 统计，降低误判。
- [误删目录风险] -> 仅删除精确命名且位于 PDF 同目录的 `Images_<pdfItemKey>` 目录，并在删除前做路径校验。

## Migration Plan

1. 先补测试：`generic-http.steps.v1` provider 行为与 mineru 输入路由行为。
2. 落地 contracts/types/compiler/provider 对 steps 的支持。
3. 新增 `workflows/mineru`（workflow.json + filter/apply hooks）。
4. 补齐 bundle 落盘与附件回写测试。
5. 运行构建和完整测试，更新文档。

## Open Questions

- MinerU API 的可选参数（如 `is_ocr/enable_formula/enable_table/language/model_version`）在本 change 先采用最小必要集合，后续可单独开 change 做参数面板扩展。
