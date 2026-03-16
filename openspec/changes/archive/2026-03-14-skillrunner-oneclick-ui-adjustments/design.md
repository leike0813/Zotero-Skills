## Context

一键部署主状态机已经收敛到 SSOT，但偏好页仍保留旧输入与文字聚合状态，且运行反馈缺少统一 toast。  
本轮只做 UI/可观测层收敛，不改动核心状态机转移规则。

## Goals / Non-Goals

**Goals:**
- 让一键部署区只保留动作与图标状态，不再显示版本输入与租约文字状态。
- 统一 `up/down/异常停止` 的 toast 反馈与图标资源。
- 固化托管本地后端 ID，并在展示层统一为多语言名称。
- backend manager 隐藏托管后端，同时避免保存普通后端时误删托管后端。

**Non-Goals:**
- 不改 one-click 启停状态机主流程。
- 不改外部 workflow/provider 协议与请求参数。

## Decisions

### Decision 1: 一键部署区图标化状态
- 运行状态使用 LED：`running=green`、`stopped=red`、`no-runtime-info=gray`、`reconciling=orange`。
- 自动拉起状态用 play 图标：`enabled=green`、`disabled=red`。
- 状态图标 tooltip 继续使用本地化文字，满足可读性。

### Decision 2: 运行反馈 toast 统一
- toast 类型统一为 `skillrunner-backend`，图标绑定 `icon_backend.png`。
- 触发点仅在成功/确定事件：
  - up 成功
  - down 成功
  - heartbeat fail 收敛到 stopped
- 同类 toast 5 秒去重，避免自动拉起场景刷屏。

### Decision 3: 托管后端身份与展示分离
- 运行时托管后端 ID 固定为 `local-skillrunner-backend`。
- 展示层通过 `backendId -> localized displayName` 映射，不直接回显固定 ID。
- dashboard/tab/管理页标题使用显示名；内部逻辑仍使用 ID 做 SSOT。

### Decision 4: backend manager 隔离托管后端
- backend manager 不显示托管后端行。
- 保存时从现有配置回填托管后端，确保用户编辑普通后端不会删除托管后端。

## Risks / Trade-offs

- [Risk] 旧运行时状态里可能残留 `skillrunner-local`。  
  Mitigation: 状态归一化时兼容映射到 `local-skillrunner-backend`。

- [Risk] toast 触发点变多可能导致噪声。  
  Mitigation: 5 秒窗口去重，并限制为关键成功/异常收敛事件。

- [Risk] 后端显示名映射覆盖不全。  
  Mitigation: 先覆盖 dashboard/管理页关键可见入口，并在后续回归补齐。
