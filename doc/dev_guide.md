# ZoteroSkillClient（Zotero 插件）开发文档：多后端可扩展架构（Core + Providers + Workflows + Handlers）

目标：把 Zotero 插件做成一个“可扩展的客户端运行时”，支持将 Zotero 条目/附件发送到不同后端（SkillRunner、本地服务、MinerU 云端 API、未来其他 API），并将结果以统一格式落库/展示。

================================================================================
0. 开发流程与约束（TDD + 文档化）
================================================================================

0.1 初始化基线
- 以 `zotero-plugin-template` 作为插件骨架
- TypeScript 编写，目标兼容 Zotero 7
- 目录结构遵循模板（`src/`、`addon/`、`test/`、`typings/`）

0.2 TDD 要求（强制）
- 每一步开发前先写测试用例（`test/` 下）
- 测试用例作为需求边界与回归保障
- 完成实现后再运行测试与类型检查

0.3 文档化要求
- 每个阶段完成后更新开发文档与变更记录
- 新增/调整流程需同步更新本文件与 `README.md`
- 测试框架策略详见 `docs/testing-framework.md`


================================================================================
1. 背景与目标
================================================================================

1.1 背景
- 现有 SkillRunner 服务：在容器内执行 Agent Skill 并返回结构化结果。
- Zotero 插件作为前端：从 Zotero 文献条目中收集附件（PDF 等）与上下文（元数据/注释），提交给后端解析与抽取，并把结果写回 Zotero（Notes/Tags/Artifacts/UI 摘要）。

1.2 目标
- 支持多个后端（SkillRunner、本地/云端 API：例如 MinerU）。
- 插件内部保持稳定的“统一 Job/Result 模型”，后端差异通过 Provider 隔离。
- Workflows 声明式配置：不修改主逻辑即可增加新的解析流程。
- 结果应用（落库/展示）与后端解耦：任何后端都产出统一的 RunBundle。


================================================================================
2. 总体架构（Zotero 端）
================================================================================

2.1 组件划分
- Core（稳定内核）
  - Selection/Context：读取选中文献条目与附件、元数据、注释等
  - Job Queue：任务队列、并发控制、重试/取消
  - Transport：HTTP/上传/下载/重试等基础通信能力
  - Local Cache：占位设计，暂不实现（后续用于请求去重、断点续传、可追溯记录）
  - UI Shell：菜单/右键、Item Pane 结果区、任务管理窗口

- Providers（协议适配层，M1 可插拔）
  - GenericProvider（http.steps）：执行 step-based RequestSpec
  - ProviderRegistry：根据 RequestSpec.kind 与 backend.type 选择 Provider
  - 未来可扩展：Streaming/CLI/Queue 等协议 Provider

- Backends（后端实例配置）
  - 描述：base_url、auth、默认 header/参数等（不含请求编排）

- Workflows（Manifest + Hooks）
  - 描述：输入约束、执行模式、结果形态；hooks 负责请求构建与结果应用

- Handlers（结果应用器）
  - 将 RunBundle 应用到 Zotero：创建/更新 Note、添加 Tag、附加产物、展示摘要等

2.2 关键设计原则
- 插件只认统一协议/模型：Job + RunBundle。
- 协议差异集中在 Provider；Transport 只负责通信细节。
- Workflow 只声明稳定信息，动态流程通过 Hooks 承载。
- 输入/输出采用双层校验：Workflow 约束 + Backend/Provider 约束。



================================================================================
3. 数据模型
================================================================================

3.1 Job（任务模型）
Job 表示一次执行请求（例如 PDF 解析、元数据抽取等）。

建议字段：
- job_id: 插件内部唯一 ID（UUID）
- backend_id: 选定后端实例（如 skillrunner-local / mineru-cloud）
- workflow_id: 触发该任务的工作流
- request_spec_kind: 请求协议类型（如 http.steps）
- item_key: Zotero item key
- inputs: 输入资源列表（附件、文本、注释、元数据等）
- parameters: 规范化参数（经 schema 校验/默认值填充）
- state: queued | running | succeeded | failed | canceled
- backend_request_id: 后端返回的任务 ID（异步后端常见）
- created_at / updated_at

3.2 RunBundle（统一输出包）
所有 Provider 必须将后端输出“转码”为统一的 RunBundle，供 Handlers 处理。

建议结构（bundle.json / manifest）：
{
  "bundle_version": "1",
  "job": {
    "backend_id": "mineru-cloud",
    "workflow_id": "paper.parse",
    "action": "pdf.parse"
  },
  "inputs": {
    "sha256": "...",
    "filename": "paper.pdf",
    "itemKey": "ABCD1234"
  },
  "outputs": {
    "primary": { "type": "document.parse", "format": "json", "path": "result.json" },
    "artifacts": [
      { "id": "md", "type": "markdown", "path": "artifacts/output.md" },
      { "id": "raw", "type": "provider.raw", "path": "artifacts/provider_raw.json" }
    ]
  },
  "meta": {
    "created_at": "...",
    "provider": { "name": "MinerU", "model": "...", "request_id": "..." }
  }
}

目录建议（Zotero profile 下缓存）：
<profile>/zotero-skillclient/
  backends.json
  workflows/
  jobs/<job_id>/
    request.json              # 规范化后的 Job 快照（可选）
    input_manifest.json
    bundle/
      bundle.json
      result.json
      artifacts/
      logs/                   # provider 原始日志/错误（可选）


================================================================================
4. Providers（协议适配层）规范
================================================================================

4.1 Provider 接口（M1 最小必需）
- execute(requestSpec, backend, transport): RunResult
  - requestSpec 为 step-based 描述（见 6.3）
  - backend 提供 base_url/auth/defaults
  - transport 负责实际 HTTP/上传/下载
- validateInput?(requestSpec, backend): ValidationResult
- validateOutput?(runResult, manifest): ValidationResult

4.2 ProviderRegistry
- 注册并管理 Provider（按 kind/type）
- 选择策略：
  - 以 requestSpec.kind 为主
  - 以 backend.type 为辅（用于兼容同类协议的不同实现）

4.3 M1 默认 Provider
- GenericProvider（kind = "http.steps"）
- 仅执行步骤序列，不内置业务逻辑


================================================================================
5. Backends（后端实例）配置与管理
================================================================================

5.1 backends.json（建议）
[
  {
    "id": "skillrunner-local",
    "type": "generic",
    "base_url": "http://127.0.0.1:8000",
    "auth": { "kind": "none" },
    "defaults": { "headers": {}, "timeout_ms": 600000 }
  }
]

5.2 插件设置 UI（建议）
- 后端列表：启用/禁用、默认后端、连通性测试（基本健康检查）
- 凭证管理：API Key/Token（安全存储，避免明文落盘）
- 云端后端提示：首次使用需确认“会上传附件到云端”，可勾选“记住选择”
- 执行策略：本地优先 / 云端优先 / 每次询问


================================================================================
6. Workflows（Manifest + Hooks）
================================================================================

M1 采用“声明式 Manifest + Hooks 脚本”的混合模式：
- Manifest 负责：可展示/可校验的稳定信息（输入约束、执行模式、结果形态）
- Hooks 负责：输入转换、请求构建、结果应用（业务逻辑）

6.1 Workflow 包结构
workflows/
  <workflow-id>/
    workflow.json
    hooks/
      filterInputs.js   # 可选
      buildRequest.js   # 必需
      applyResult.js    # 必需

6.2 workflow.json 示例（M1）
{
  "id": "literature.digest",
  "label": "Literature Digest (MD)",
  "version": "1.0.0",
  "backend": "skillrunner-local",
  "inputs": {
    "attachments": { "mime": ["text/markdown", "text/x-markdown", "text/plain"], "max": 1 }
  },
  "hooks": {
    "filterInputs": "hooks/filterInputs.js",
    "buildRequest": "hooks/buildRequest.js",
    "applyResult": "hooks/applyResult.js"
  },
  "execution": {
    "mode": "auto",
    "poll_interval_ms": 2000,
    "timeout_ms": 600000
  },
  "result": {
    "fetch": { "type": "bundle" },
    "expects": {
      "result_json": "result/result.json",
      "artifacts": ["artifacts/**"]
    }
  }
}

说明：
- Manifest 的 result 只描述“接口返回了什么/如何获取”，不负责落库或创建笔记。
- 结果应用逻辑由 applyResult Hook 执行。

6.3 RequestSpec（M1 = http.steps）
buildRequest 必须返回 step-based RequestSpec，示意：
{
  "kind": "http.steps",
  "steps": [
    {
      "id": "create",
      "request": { "method": "POST", "path": "/v1/jobs", "json": { "skill_id": "...", "parameter": {} } },
      "extract": { "request_id": "$.request_id", "status": "$.status" }
    },
    {
      "id": "upload",
      "request": { "method": "POST", "path": "/v1/jobs/{request_id}/upload", "multipart": true },
      "files": [{ "key": "INPUT_KEY", "path": "/abs/path/file.md" }]
    },
    {
      "id": "poll",
      "request": { "method": "GET", "path": "/v1/jobs/{request_id}" },
      "repeat_until": "status in ['succeeded','failed']"
    },
    {
      "id": "bundle",
      "request": { "method": "GET", "path": "/v1/jobs/{request_id}/bundle" }
    }
  ]
}

6.4 Hooks 说明（最小接口）
- filterInputs(ctx): 输入过滤/校验，返回 InputSelection（可选）
- buildRequest(ctx, input): 构建 RequestSpec（必需，且不直接发请求）
- applyResult(ctx, result): 处理结果并落库（必需）

6.5 execution.mode
- auto：由 Provider 根据 steps 与返回状态自动判定（默认）
- sync：同步返回结果（无需轮询）
- async：异步任务（需要 poll + fetch）

6.6 Workflow 加载位置
- 插件内置：workflows/（随版本发布）
- 用户覆盖（可选，后续）：<profile>/zotero-skillclient/workflows/


================================================================================
7. Handlers（结果应用器：落库/展示策略）
================================================================================

7.1 核心原则
Handlers 只依赖 RunBundle（统一模型），不依赖 Provider/后端。
applyResult Hook 可直接调用 Handlers，或覆盖默认处理策略。

7.2 常见 Handler
- NoteHandler
  - 根据模板把 result.json / output.md 渲染成 Markdown/HTML 写入 Note
  - 支持创建子笔记（child note）或更新指定笔记
- TagHandler
  - 添加/移除 tags（如 ai/extracted、ai/needs-review）
- ArtifactHandler
  - 将 artifacts（md/json/zip）作为附件保存到条目下
  - 或保存到 profile cache 并在 UI 提供打开入口
- UISummaryHandler
  - 在 Item Pane 自定义 section 显示：状态、摘要、最近一次 run、按钮（重新运行、打开产物、查看日志）


================================================================================
8. 输入清单与去重（强烈建议）
================================================================================

8.1 input_manifest.json
对附件计算 hash（建议 sha256），并记录：
- filename, size, sha256（必要）
- item_key
- workflow_id, request_spec_kind
- normalized_parameters（规范化后的参数快照）
- inputs flags（是否包含 metadata/annotations 等）

8.2 去重策略建议
- dedup_key = sha256 + workflow_id + normalized_parameters + normalized_inputs_flags
- 若已存在成功 bundle：
  - 可直接“复用结果”
  - 或提示“已存在结果，是否重新运行？”


================================================================================
9. 安全与合规边界（必须）
================================================================================

- Workflow hooks 只允许插件内置/本地随插件发布的代码，不允许在线拉取/执行远程 JS。
- 记录每次 run 的“外发内容摘要”（发送了哪些附件/元数据/注释），可供用户审计与排查。


================================================================================
10. 两种扩展路线（后续演进）
================================================================================

10.1 路线 A：统一协议（http.steps）
M1 即采用 step-based RequestSpec，由 GenericProvider 执行。
新增后端只需新增 backend 配置与 workflow hooks，不改插件代码。

10.2 路线 B：专用 Provider（可选）
当某类协议无法用 steps 描述或需要深度优化，可新增专用 Provider。
此路线为扩展选项，不影响 M1 的通用可插拔目标。


================================================================================
11. 里程碑（建议实施顺序）
================================================================================

M1：核心可用（通用可插拔协议）
- Core：Job Queue + Transport + UI（最简）
- ProviderRegistry + GenericProvider（http.steps）
- Backends.json 支持多实例
- Workflow 包（Manifest + Hooks）内置 1 个（literature.digest）
- NoteHandler + ArtifactHandler（通过 applyResult 调用）

M2：多后端（加入 MinerU）
- 新增 MinerU backend 配置 + workflow hooks
- backend 配置 UI + 云端外发提示
- backend=auto 策略初版

M3：规范化与生态
- RunBundle schema 固化 + bundle_version
- Workflow schema 校验（JSON Schema）
- Runner Protocol v1 草案与桥接服务（可选）


================================================================================
12. 实现检查清单（Checklist）
================================================================================

- [ ] Job Queue：并发限制、失败重试、取消
- [ ] ProviderRegistry：注册与选择
- [ ] GenericProvider：http.steps 执行与错误映射
- [ ] RunBundle：统一格式 + bundle_version
- [ ] Workflow：Manifest + Hooks + RequestSpec（http.steps）
- [ ] Handlers：note/tag/artifact/ui summary
- [ ] 输入 manifest：sha256 + 去重 key
- [ ] 云端安全提示：首次确认 + 可记住
- [ ] 调试入口：查看 provider 原始响应、日志、bundle 内容


================================================================================
13. 术语表
================================================================================

- Provider：协议适配器（执行 RequestSpec）
- Backend instance：后端实例配置（base_url、auth、defaults）
- Workflow：Manifest + Hooks（输入约束 + 请求构建 + 结果应用）
- Handler：RunBundle 的落库/展示策略
- RunBundle：统一输出包（结构化结果 + artifacts + 元信息）
- RequestSpec：step-based 请求描述（http.steps）

================================================================================
附录：Architecture Flow
================================================================================

本项目运行逻辑详见 `docs/architecture-flow.md`。
