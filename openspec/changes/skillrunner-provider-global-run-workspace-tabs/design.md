## Context

现状 run dialog 按 `backendId::requestId` 多窗口管理。  
目标是保持右侧详情交互不变，把入口与承载改为单例工作区，并引入左侧任务分组导航。

## Goals / Non-Goals

**Goals**

- 全局唯一 run workspace：任意入口打开任务详情都路由到同一窗口。
- 左侧按 backend profile 分组，终态任务进入“已结束任务”子气泡。
- 右侧复用现有 run detail 结构（聊天、pending/auth、reply/cancel）。
- 会话内折叠状态管理（不持久化）。

**Non-Goals**

- 不改 provider 协议与后端 API。
- 不改 dashboard 主页面整体导航结构。
- 不扩展 generic-http 任务详情形态。

## Decisions

### Decision 1: API 保持 `openSkillRunnerRunDialog`，内部切为单例路由

- 外部调用点不改。
- 当窗口已存在时仅聚焦并切换目标任务。
- 当窗口不存在时创建窗口并定位目标任务。

### Decision 2: 左侧分组模型由 host 快照下发

- host 统一合并 `active + history` 任务，按 backendId 分组。
- 任务状态分桶基于 `stateSemantics.terminal`：
  - `terminal=false` -> 主组任务列表
  - `terminal=true` -> “已结束任务”子气泡
- 任务标题规则：`taskName -> workflowLabel -> requestId`。
- 无 `requestId` 任务：显示、禁用、提示“等待 requestId”。

### Decision 3: 折叠与排序策略

- profile 分组默认展开。
- “已结束任务”子气泡默认折叠。
- 折叠状态仅会话内保存（内存 map，不写 pref）。
- 组内任务按 `updatedAt` 降序；组按最近任务 `updatedAt` 降序。

### Decision 4: 右侧详情保持原协议与行为

- run-detail 字段继续复用既有 `session` 快照字段。
- reply/cancel/auth-import 继续走 `run-dialog:action`，作用于当前选中任务。
- 左侧只负责选择上下文，不复制右侧业务逻辑。

## Data Contract

run workspace host 向前端下发：

- `workspace.groups[]`
  - `backendId`
  - `backendDisplayName`
  - `collapsed`
  - `finishedCollapsed`
  - `activeTasks[]`
  - `finishedTasks[]`
- `workspace.selectedTaskKey`
- `session`（当前选中任务详情；沿用既有 run detail 字段）

前端动作：

- `ready`
- `select-task`
- `toggle-group-collapse`
- `toggle-finished-collapse`
- 既有 `reply-run` / `cancel-run` / `auth-import-run`

## Risks / Trade-offs

- [Risk] 切换任务时 observer 频繁切换导致瞬时抖动。  
  Mitigation: 任务切换时先推送快照，再串行启动新 observer。

- [Risk] 历史任务 backend 配置缺失导致详情请求失败。  
  Mitigation: 保留任务可见性；错误在右侧详情区可观测呈现。

- [Risk] 前端 run-dialog 改造面较大。  
  Mitigation: 保持右侧 DOM id 与交互入口稳定，新增左侧区域最小侵入。
