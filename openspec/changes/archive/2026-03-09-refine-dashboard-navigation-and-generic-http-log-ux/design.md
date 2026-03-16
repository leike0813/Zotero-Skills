## Context

本 change 在已有 browser-hosted Dashboard 基础上做可用性增强，不改变 provider 执行协议和任务生命周期语义。

## Goals / Non-Goals

**Goals**

- 提供主窗口顶部一键进入 Dashboard 的快捷入口。
- Generic HTTP 日志从“纯文本块”升级为结构化可追踪视图。
- 保证日志窗口始终绑定到用户显式选择的任务，避免同 backend 多任务混流。
- 提升侧栏信息架构与按钮视觉一致性。
- backend 空任务时展示正确空态。

**Non-Goals**

- 不改 SkillRunner provider 协议与执行链。
- 不引入新的后端日志 API 依赖。
- 不变更 SkillRunner Run 独立窗口机制。

## Architecture

### 1) Toolbar 快捷入口

- 新增 `dashboardToolbarButton` 模块，负责：
  - 在主窗口 toolbar 注入按钮；
  - 触发 `openDashboard` 事件；
  - 在窗口 unload/shutdown 清理按钮避免重复挂载。

### 2) Generic HTTP 日志视图模型

- `taskManagerDialog` snapshot 中为 generic backend 增加：
  - `selectedLogTaskId`
  - `logRows`
  - `selectedLogEntryId`
  - `selectedLogEntryPayload`
- 日志过滤策略按任务标识强约束：
  - 优先 `requestId`
  - 其次 `jobId`
  - 最后 `workflowId`

### 3) Dashboard Web UI 渲染

- 侧栏分组渲染：Home 区和 Backends 区，中间使用分隔线。
- Generic HTTP 页渲染为：
  - 任务表（可点击切换日志绑定任务）
  - 日志表（只展示当前绑定任务日志）
  - 日志详情抽屉（展示选中日志条目的结构化 payload）
- actions 按钮统一最小宽高，避免中英文切换造成按钮尺寸抖动。

## Risks / Trade-offs

- 若任务没有 requestId/jobId，只能退化用 workflowId 过滤，可能扩大日志集合。
  - 通过显式“当前绑定任务标识”提示降低误判。
- 顶栏按钮挂载点依赖 Zotero toolbar 结构。
  - 使用主挂载点 + 退化挂载点，并在不存在时安全 no-op。

