# Workflows 组件说明

## 目标

定义工作流包（Manifest + Hooks）的加载、校验与分发策略，为 UI Shell 与 Job Queue 提供稳定输入。

## 职责

- 从用户配置的目录加载 Workflow 包（`workflow.json` + `hooks/**`）
- 校验结构合法性（字段、输入约束、执行配置、hooks 路径）
- 对外提供可查询的 Workflow 列表
- 维护 Workflow 与后端实例的映射

## 输入

- Workflow 包目录路径
- workflow.json 文件
- hooks/*.js 文件（可选/必需）
- Hook 运行时内建函数：见 `doc/components/workflow-hook-helpers.md`

## 输出

- `Workflow` 清单
- 校验错误与警告

## 结构（M1）

```
WorkflowManifest {
  id: string
  label: string
  version?: string
  backend?: { skillId?: string; engine?: string; backendId?: string }
  defaults?: Record<string, unknown>
  inputs?: {
    unit: "attachment" | "parent" | "note"
    accepts?: {
      mime?: string[]               // for unit=attachment
    }
    per_parent?: {                 // for unit=attachment
      min?: number
      max?: number
    }
  }
  request?: {
    kind: string
    // declarative request config
  }
  hooks: {
    filterInputs?: string
    buildRequest?: string
    applyResult: string
  }
  execution?: {
    mode?: "auto" | "sync" | "async"
    poll_interval_ms?: number
    timeout_ms?: number
  }
  result?: {
    fetch?: { type: "bundle" | "result" }
    expects?: {
      result_json?: string
      artifacts?: string[]
    }
  }
}
```

说明：
- `applyResult` 必需（必须能落库/应用结果）
- `buildRequest` 能力必需，但实现方式二选一：
  - `hooks.buildRequest`（代码模式）
  - `request`（声明模式）
- 当两者同时存在时，优先使用 `hooks.buildRequest`

## 行为与边界

- 未定义字段忽略，但记录警告
- 重复 id 的工作流后加载覆盖先加载
- hooks.applyResult 必需；filterInputs 可选
- buildRequest 能力必需（`hooks.buildRequest` 或 `request` 至少一个）
- execution.mode 缺省为 "auto"
- Workflow-level 输入校验必须执行（基于 inputs，第一层过滤）
- Workflow-level 输出校验可选（基于 result.expects）

### Loader 运行时兼容约束（新增）

- `loader` 必须同时支持 Zotero 与 Node 两种运行时。
- 禁止在 `loader` 顶层静态引入 Node 内置模块（如 `fs/path/url`），避免 Zotero 打包失败。
- 路径拼接必须先做 segment 归一化，再交给 `PathUtils.join`，避免 `NS_ERROR_FILE_UNRECOGNIZED_PATH`。
- Hook 加载策略：
  - Zotero：优先脚本加载器加载；失败时回退到文本导出转换。
  - Node：优先动态 import；失败时回退到文本导出转换。

### 输入筛选策略（M1）

- M1 固定输入单元类型：`attachment`、`parent`、`note`。
- 声明式 `inputs` 只做“可理解的一阶筛选”：
  - `unit`：工作流接受的输入单元类型；
  - `accepts.mime`：附件类型白名单（仅 `unit=attachment`）；
  - `per_parent.min/max`：同一父条目下可接受附件数量约束（仅 `unit=attachment`）。
- M1 不引入批处理调度配置：每个合法输入单元单独生成一个 Job（等价 `per_input`）。
- 复杂规则（同父条目多附件裁决、同名优先、时间优先等）不放声明式，统一放在 `hooks.filterInputs`。

### literature-digest 约定（当前实现）

- 输入类型：`unit=attachment`。
- 初筛：`accepts.mime` 约束 markdown，`per_parent.max=1` 约束同父唯一。
- 歧义裁决：当同父条目下存在多个候选 markdown 时，由 `hooks/filterInputs.js` 进行裁决。
- 输出目标：每个合法输入单元单独生成一个 Job，并将结果应用到其父条目。

### 职责边界补充约束（M1）

- 声明式 `inputs` 保持轻量：仅用于“可理解的一阶筛选”（输入单元类型、附件 mime、同父数量约束），不承载复杂关联约束。
- `hooks.filterInputs` 仅在“声明后仍存在歧义”时触发，负责歧义裁决（同父多附件择一、跨对象关联判断、优先级策略等）。
- 插件内核可提供“可复用且中性”的 helper；Workflow 私有规则应保留在对应 hook 中。
- 若 `filterInputs` 缺失，或 hook 未能返回合法输入单元，则该歧义输入单元记错并跳过，不阻断其他合法输入单元。
- 若最终合法输入单元为 0，UI 层应将该 Workflow 置为禁用并展示原因（M1 先做禁用+原因）。
- 对 literature-digest：`chooseMarkdownByPdfOrEarliest` 属于私有策略；其内部可复用通用 helper（例如最早 PDF 选择）。

## RequestSpec（M1 = http.steps）

buildRequest 最终必须产出 step-based RequestSpec（由 Provider 执行）：

```
RequestSpec {
  kind: "http.steps"
  steps: Array<{
    id: string
    request: { method: string; path: string; json?: object; query?: object; headers?: object }
    files?: Array<{ key: string; path: string }>
    extract?: Record<string, string>
    repeat_until?: string
  }>
}
```

### skillrunner.job.v1 声明式上传映射（M1.1）

`workflow.request.input.upload.files` 用于声明 Zip 内输入文件名（即 Skill input schema key）与当前输入单元文件来源的映射：

```json
{
  "request": {
    "kind": "skillrunner.job.v1",
    "input": {
      "upload": {
        "files": [
          { "key": "md_path", "from": "selected.markdown" },
          { "key": "pdf_path", "from": "selected.pdf" }
        ]
      }
    }
  }
}
```

约束：
- `key` 必须唯一（对应 Zip 内文件名）。
- `from` 当前支持：`selected.markdown`、`selected.pdf`。
- 每个 `from` 在当前输入单元中必须唯一命中一个附件；否则该输入单元报错并跳过。
- 复杂歧义裁决仍由 `hooks.filterInputs` 负责，声明只做映射与基础校验。

### 声明式 buildRequest（推荐）

- 当 `request.kind` 已被内核支持时，Workflow 可不写 `hooks.buildRequest`
- 当前首个内置 kind：`skillrunner.job.v1`（编译为 `http.steps`）
- 无法覆盖的场景再使用 `hooks.buildRequest` 覆写

## 测试点（TDD）

- 正确加载多个 workflow 包
- hooks 路径不存在时的错误与告警
- execution 默认值与 mode 解析
