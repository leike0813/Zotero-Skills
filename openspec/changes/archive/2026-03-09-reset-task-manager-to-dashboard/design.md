## Context

重构目标是把 Task Dashboard 从“特权层拼 UI”切换到“本地 Web 面板”，并补齐 running 任务即时可见与 SkillRunner 对话入口可达性。

本次仍保持执行链为 Auto 模式，不引入新的 workflow 语义变更。

## Goals / Non-Goals

**Goals**

- 使用本地 Web 页面承载 Dashboard UI，提升视觉一致性与可维护性。
- 侧边导航改为整页 Tab 切换，提供独立 Home 页面。
- running 任务在 Dashboard 和 backend 页即时可见。
- SkillRunner create 后立即暴露 requestId，running 阶段即可打开 run 对话页。
- 保留 SkillRunner 详情交互（SSE+history、reply、cancel）。

**Non-Goals**

- 不复刻 SkillRunner 后端完整 UI。
- 不改变 Pass-through 忽略策略。
- 不修改 provider 执行结果语义（仅新增 progress 通知）。

## Architecture

### 1. Browser-hosted Dashboard

- `taskManagerDialog` 仅负责：
  - 打开容器对话框；
  - 挂载本地 Web 页面 `chrome://.../content/dashboard/index.html`；
  - 维护 host bridge、状态订阅和 action 分发。
- 页面实际渲染逻辑下沉至 `addon/content/dashboard/app.js`。

### 2. Host Bridge Protocol

- Host -> Web
  - `dashboard:init`: 首帧初始化
  - `dashboard:snapshot`: 增量快照刷新
- Web -> Host
  - `dashboard:action`:
    - `ready`
    - `select-tab`
    - `view-logs`
    - `open-run`
    - `reply-run`
    - `cancel-run`
    - `open-management`

### 3. Snapshot Model

- 抽离 `taskDashboardSnapshot`，负责纯数据模型计算：
  - backend 列表归一化（配置 + history + running 发现）；
  - running/history 合并（按 task id 去重，按更新时间优先）；
  - tab key 归一化（非法 tab 回退到 `home`）。
- host 将 snapshot 发送给 Web，Web 只做渲染和动作派发。

### 4. requestId Early Visibility

- provider 执行合同新增 `onProgress(event)`。
- SkillRunner 在 `/v1/jobs` create 成功后发送：
  - `{ type: "request-created", requestId }`
- JobQueue 新增 progress 管道：
  - 接收 progress 后更新 `job.meta.requestId`
  - 触发 `onJobUpdated`，让 taskRuntime/history 立即可见 requestId。

### 5. SkillRunner Observe

- 继续复用现有管理客户端：
  - chat SSE + history 补偿；
  - pending/reply/cancel；
  - management UI 跳转按钮。
- 观察状态由 host 维护，Web 通过 snapshot 展示。

## Risks / Trade-offs

- Web 页面与 host 桥接增加边界复杂度。
  - Mitigation：bridge 合同固定、host 做统一 action 校验。
- running/history 合并可能出现短期状态抖动。
  - Mitigation：按 `updatedAt` 选择最新记录，running 优先展示。
- 本地 Web UI 不依赖远端样式，仍需持续维护视觉同构。
  - Mitigation：抽离基础 token，后续可逐步完善。

