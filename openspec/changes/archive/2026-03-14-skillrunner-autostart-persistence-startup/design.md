## Context

当前本地运行时自动拉起由 `autoStartEnabledInSession` 控制，且状态不落盘；`onStartup` 会先重置为关闭，再执行 startup preflight。  
该行为会覆盖用户上次选择，且与“开关是用户偏好”的预期冲突。

## Goals / Non-Goals

**Goals**

- 自动拉起开关在插件重启后保持一致（持久化真源）。
- 启动阶段严格按持久化开关门控 startup preflight。
- 维持既有 preflight/stop 自动改写策略，但改写必须持久化。

**Non-Goals**

- 不新增独立 pref key。
- 不改动 one-click/stop/uninstall 事件接口。
- 不改动 auto-ensure 核心链路与按钮矩阵。

## Decisions

### Decision 1: 继续复用 runtime state JSON 存储 auto-start

- `ManagedLocalRuntimeState.autoStartPaused` 恢复为有效字段。
- `writeManagedLocalRuntimeState` 不再删除该字段。

### Decision 2: 引入统一“会话+持久化同步写”入口

- 所有开关改写（按钮 toggle、preflight 成败、手动 stop）都走同一入口。
- 默认策略为“会话更新 + 持久化更新”；测试专用 reset 允许会话内重置但不落盘。

### Decision 3: 启动阶段改为“hydrate 后门控”

- `onStartup` 先从持久化 hydrate 到会话。
- 仅当开关为开启时才调用 `runManagedRuntimeStartupPreflightProbe`。
- `runManagedRuntimeStartupPreflightProbe` 新增 `startup-preflight-skip-paused` 分支。

### Decision 4: 缺失值默认关闭

- 当 `autoStartPaused` 缺失，解释为 paused=true（即 auto-start 关闭）。
- 不强制首次补写，避免无谓更新 state JSON。

## Risks / Trade-offs

- [Risk] 更多路径会触发 runtime state 写入  
  → Mitigation: 同步写入口先比较值，相同则不写。

- [Risk] 旧测试依赖 session-only 语义  
  → Mitigation: 迁移为 hydrate/persist 语义断言，补充 startup 门控用例。
