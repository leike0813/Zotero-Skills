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

## 输出

- `Workflow` 清单
- 校验错误与警告

## 结构（M1）

```
WorkflowManifest {
  id: string
  label: string
  version?: string
  backend: string
  inputs: {
    attachments?: { mime?: string[]; max?: number }
  }
  hooks: {
    filterInputs?: string
    buildRequest: string
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

## 行为与边界

- 未定义字段忽略，但记录警告
- 重复 id 的工作流后加载覆盖先加载
- hooks.buildRequest 与 hooks.applyResult 必需；filterInputs 可选
- execution.mode 缺省为 "auto"
- Workflow-level 输入校验必须执行（基于 inputs）
- Workflow-level 输出校验可选（基于 result.expects）

## RequestSpec（M1 = http.steps）

buildRequest 必须返回 step-based RequestSpec（由 Provider 执行）：

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

## 测试点（TDD）

- 正确加载多个 workflow 包
- hooks 路径不存在时的错误与告警
- execution 默认值与 mode 解析
