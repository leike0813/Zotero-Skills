# Workflows 组件说明

## 目标

定义 Workflow 包（manifest + hooks）的加载、校验与执行入口，为 UI 与执行内核提供稳定输入。

## 目录结构

```text
workflows/
  <workflow-id>/
    workflow.json
    hooks/
      filterInputs.js   # 可选
      buildRequest.js   # 可选（声明式 request 无法覆盖时使用）
      applyResult.js    # 必需
```

## Manifest（当前实现）

```ts
type WorkflowManifest = {
  id: string;
  label: string;
  provider?: string;
  version?: string;
  parameters?: Record<string, WorkflowParameterSchema>;
  inputs?: {
    unit: "attachment" | "parent" | "note";
    accepts?: { mime?: string[] };
    per_parent?: { min?: number; max?: number };
  };
  execution?: {
    mode?: "auto" | "sync" | "async";
    poll_interval_ms?: number;
    timeout_ms?: number;
  };
  result?: {
    fetch?: { type?: "bundle" | "result" };
    expects?: { result_json?: string; artifacts?: string[] };
  };
  request?: WorkflowRequestSpec;
  hooks: {
    filterInputs?: string;
    buildRequest?: string;
    applyResult: string;
  };
};
```

说明：

- `hooks.applyResult` 必需。
- buildRequest 能力必需，但实现方式二选一：
  - `hooks.buildRequest`
  - `request`（声明式）
- 两者同时存在时，优先 `hooks.buildRequest`。
- `provider` 建议显式声明；若缺失，loader 会按 `request.kind` 推断。

## 已废弃字段（会被视为非法 manifest）

下列字段已弃用，出现即视为无效 workflow：

- 顶层 `backend`
- 顶层 `defaults`
- `request.result`
- `request.create.engine`
- `request.create.model`
- `request.create.parameter`
- `request.create.runtime_options`

## 声明式 request（当前支持）

由 `src/workflows/declarativeRequestCompiler.ts` 编译：

- `skillrunner.job.v1`
- `generic-http.request.v1`

### skillrunner.job.v1 关键约束

- `request.create.skill_id` 必填
- `request.input.upload.files` 必填
- `files[].from` 当前支持：
  - `selected.markdown`
  - `selected.pdf`
- 每个 selector 在当前输入单元必须唯一命中，否则该输入单元报错/跳过

## 输入筛选策略

- 声明式 `inputs` 负责一阶筛选（unit/mime/per_parent）
- 复杂裁决放到 `hooks.filterInputs`
- 若最终合法输入单元为 0，执行阶段会报“无合法输入”并进入跳过提示

## 运行时兼容

- loader 同时支持 Zotero 与 Node。
- 禁止在 loader 顶层静态引入 Node 内置模块（避免 Zotero 打包失败）。
- Hook 加载策略：
  - Node：动态 import，失败回退到文本导出转换
  - Zotero：脚本加载器，失败回退到文本导出转换

## applyResult 约束

- `applyResult` 通过 `bundleReader` 与 `runResult` 获取执行输出。
- 当 provider 仅返回 `resultJson`（无 bundle）时，`bundleReader.readText()` 会抛错，hook 应按 `runResult` 分支处理。

## 测试点（TDD）

- manifest 字段校验与废弃字段拒绝
- hooks 路径与导出函数校验
- `buildStrategy = hook | declarative` 分支行为
- 声明式 request 编译与输入映射约束
- Node/Zotero 双运行时 loader 行为
