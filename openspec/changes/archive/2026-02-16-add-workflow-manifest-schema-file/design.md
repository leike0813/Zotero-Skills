## Context

当前 workflow manifest 校验集中在：

- `src/workflows/loaderContracts.ts`（manifest 解析、形状检查、弃用字段拦截）
- `src/workflows/loader.ts`（provider 推断、build strategy 判定、hooks 文件与导出检查）

仓库中还没有独立的 workflow manifest schema 文件。  
用户在编写 workflow.json 时，缺少统一、可直接消费的契约文档。
同时运行时校验规则与文档规则存在分叉风险。

## Goals / Non-Goals

**Goals:**

- 提供独立 schema 文件，清晰表达 workflow.json 的结构约束。
- 让用户无需阅读源码即可理解最小合法声明和常见可选字段。
- 将 loader manifest 校验切换为统一使用该 schema（SSOT）。
- 保持 workflow 执行语义不变，仅统一声明校验来源。

**Non-Goals:**

- 不重构 workflow runtime 执行架构或 request contract。
- 不扩展新业务 workflow 功能。

## Decisions

### Decision 1: schema 文件作为 manifest 校验 SSOT

- 提供独立 JSON Schema 文件（建议位置：`src/schemas/workflow.schema.json`）。
- 该文件同时服务于作者文档与运行时校验。
- loader 在 manifest 解析后，统一调用 schema 校验器进行结构验证。

### Decision 2: schema 覆盖“关键可见约束”

- 覆盖最小必需字段：`id`、`label`、`hooks.applyResult`。
- 覆盖主要可选结构：`provider`、`parameters`、`inputs`、`execution`、`result`、`request`、`hooks`。
- 对已弃用字段给出约束（例如通过 `not`/说明禁止 legacy 字段）。

### Decision 3: 运行时接入采用 JSON Schema 校验器（AJV）

- 使用现有依赖 `ajv`/`ajv-formats` 在 loaderContracts 中编译并缓存 schema 校验器。
- 失败路径继续复用现有 diagnostic 输出结构（`manifest_validation_error`），减少上层改动。

### Decision 4: 非结构类校验仍保留在代码层

- schema 负责 manifest 结构与字段约束。
- provider 推断、build strategy 判定、hooks 文件存在性与模块导入等运行时检查保持在现有代码路径。

## Risks / Trade-offs

- [Risk] schema 变更可能引发历史 workflow 不兼容  
  -> Mitigation: 先按当前 loader 语义建模，并用 fixture 回归保证兼容边界可见。

- [Risk] AJV 接入带来实现复杂度与错误信息差异  
  -> Mitigation: 封装统一错误归一化，保持 loader diagnostics 文案稳定。

- [Risk] 结构校验与语义校验边界不清  
  -> Mitigation: 在设计与测试中显式区分 schema 校验失败与后续运行时语义失败。
