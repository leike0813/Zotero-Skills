# SkillRunner Provider Global Run Workspace Tabs SSOT

## Purpose

定义 SkillRunner 任务运行详情“全局唯一工作区”的页面模型、分组规则、路由规则和交互不变量，作为后续实现与回归的单一真源。

## Layout Contract

- 页面采用左右结构：
  - 左侧：任务分组 tab 区（按 backend profile）
  - 右侧：运行详情区（沿用现有 run detail 布局）
- 右侧仅展示“当前选中任务”的详情会话。

## Routing Contract

- 对外入口保持 `openSkillRunnerRunDialog(...)`。
- 路由收敛：
  - 窗口未打开：创建 workspace 并定位目标任务
  - 窗口已打开：聚焦并切换目标任务
- 禁止同一时间出现多个 SkillRunner run-details 窗口。

## Grouping and Bucketing

- 仅处理 SkillRunner provider 任务。
- 左侧分组键：`backendId`。
- 组标题：`displayName`（无则 fallback 到 backendId 解析名）。
- 组内任务分桶：
  - `terminal=false` -> 主任务列表
  - `terminal=true` -> “已结束任务”子气泡

## Ordering and Collapse

- 任务排序：`updatedAt DESC`。
- 分组排序：组内最新任务时间 `DESC`。
- profile 组默认展开。
- “已结束任务”子气泡默认折叠。
- 折叠状态仅会话内生效，不持久化。

## Task Tab Rules

- 标题回退：`taskName -> workflowLabel -> requestId`。
- 无 `requestId`：
  - 任务可见
  - 任务不可选
  - 展示“等待 requestId”提示
- 终态任务 tab 使用紧凑样式（更低高度、更小字号）。

## Snapshot SSOT

host -> web:

- `workspace.groups[]`
- `workspace.selectedTaskKey`
- `session`（当前任务详情）

web -> host:

- `select-task`
- `toggle-group-collapse`
- `toggle-finished-collapse`
- 复用：`reply-run` / `cancel-run` / `auth-import-run`

## Invariants

1. 同一时刻仅有一个 run workspace window。
2. 右侧 session 始终与左侧 selectedTaskKey 对齐。
3. 无 requestId 任务不得触发详情会话动作。
4. 终态任务必须进入“已结束任务”子气泡，不得与非终态混排。
