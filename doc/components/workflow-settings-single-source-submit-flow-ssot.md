# Workflow Settings Single-Source Submit Flow SSOT

## 1. Scope

本 SSOT 约束以下两类入口的 workflow 设置行为：

- 交互提交流程中的“提交前设置页”（独立网页弹窗）
- Dashboard 顶层 `Workflow选项` 页（持久配置管理）

不在本文件范围：

- provider 协议与请求格式定义
- workflow 业务逻辑本体

## 2. Single Source of Truth

### 2.1 Persisted Source

- 唯一持久化来源：`workflowSettingsJson`
- 持久字段：`backendId`、`workflowParams`、`providerOptions`

### 2.2 Submit Snapshot

- 执行时允许传入一次性 `executionOptionsOverride`
- 合并规则：`persisted <- override`
- 一次提交（一个 trigger）只解析一次 snapshot，并广播到同一 batch 所有 job

## 3. Configurability Predicate

workflow 被判定为“可配置”当且仅当以下任一维度可编辑：

- backend profile 维度可编辑
  - `requiresBackendProfile=true` 且 profile 数量不等于 1
- workflow parameter schema 非空
- provider runtime option schema 非空

当 `requiresBackendProfile=true` 且 profile 数量为 0 时，视为“可配置但阻塞提交”。

## 4. Interaction Contracts

### 4.1 Interactive Trigger Gate

- 交互入口（例如右键菜单执行 workflow）必须先经过设置门禁
- 判定无可配置项：直接提交
- 判定有可配置项：打开该 workflow 的提交前设置弹窗
- 用户取消：终止提交
- profile 缺失：弹窗内阻止确认

### 4.2 Submit Dialog Contract

弹窗返回结构：

```ts
{
  status: "confirmed" | "canceled";
  executionOptions?: WorkflowExecutionOptions;
  persist?: boolean;
}
```

规则：

- `persist=true`：先写入持久配置，再执行
- `persist=false`：只用于本次执行

### 4.3 Dashboard Workflow Options Contract

- 顶层 tab：`workflow-options`
- 子 tab：仅显示“可配置 workflow”
- 编辑行为：防抖持久化（无确认按钮）
- 可观测保存状态：`saving` / `saved` / `error`
- 处于 `workflow-options` tab 时，周期刷新与任务变更刷新不得重建表单

### 4.4 SkillRunner Runtime Options Mode Contract

- `skillrunner_mode=interactive`
  - 显示并生效：`interactive_auto_reply`、`hard_timeout_seconds`
  - 隐藏并丢弃：`no_cache`
- `skillrunner_mode=auto`
  - 显示并生效：`no_cache`、`hard_timeout_seconds`
  - 隐藏并丢弃：`interactive_auto_reply`
- `hard_timeout_seconds` 仅允许正整数；空值表示后端默认

### 4.5 Submit Dialog Shape Contract

- 提交弹窗仅保留页面内 `确认/取消` 按钮
- 不允许框架层重复注入额外取消按钮
- 弹窗布局采用紧凑尺寸，不与 Dashboard 配置页等比

## 5. Invariants

1. 执行链不读取 run-once map。  
2. 交互触发 workflow 时，提交门禁不可绕过（除非显式非交互调用）。  
3. 同批次 job 的 execution snapshot 必须一致。  
4. Dashboard 与提交弹窗都必须基于同一 host 侧 descriptor（字段定义、默认值、profile 列表）。  
5. `openWorkflowSettings` 偏好事件必须路由到 Dashboard `workflow-options`，不再打开旧设置对话框。  
6. 数值字段非法输入不得落盘，必须给出字段级错误提示。  
7. 运行时文案语义统一为“默认配置 / default settings”，不得回退到“持久/persistent”。  

## 6. Sequence (Interactive Trigger)

1. user trigger workflow  
2. resolve `isWorkflowConfigurable`  
3. if false -> execute directly  
4. if true -> open submit web dialog  
5. dialog confirm -> receive `{executionOptions, persist}`  
6. if `persist` -> `updateWorkflowSettings`  
7. run preparation seam with `executionOptionsOverride`  
8. build requests / dispatch

## 7. Compatibility Notes

- 旧 run-once API 保留兼容壳，返回/写入不再影响执行语义。
- 旧 workflow settings 对话框不在主路径调用链中，仅保留兼容窗口。
