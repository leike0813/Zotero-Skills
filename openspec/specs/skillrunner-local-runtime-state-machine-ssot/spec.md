# skillrunner-local-runtime-state-machine-ssot Specification

## Purpose
TBD - created by archiving change skillrunner-oneclick-state-machine-ssot. Update Purpose after archive.
## Requirements
### Requirement: Local Runtime One-Click Flow SHALL Consume a Single State Machine SSOT
本地一键部署/启动链路 MUST 由统一状态机合同驱动，所有按钮动作与状态切换 SHALL 仅依赖该合同。

#### Scenario: One-click action with runtime info
- **WHEN** 用户点击一键部署/启动且存在 runtime info
- **THEN** 系统 SHALL 先执行 preflight
- **AND** preflight 成功后 SHALL 执行 `up -> lease acquire`
- **AND** preflight 失败后 SHALL 进入 deploy 流程

#### Scenario: One-click action without runtime info
- **WHEN** 用户点击一键部署/启动且不存在 runtime info
- **THEN** 系统 SHALL 直接进入 deploy 流程

#### Scenario: One-click deploy branch waits post-deploy preflight
- **WHEN** one-click 进入 deploy 且 deploy 成功
- **THEN** 系统 SHALL 执行 post-deploy preflight 并等待其结果再返回
- **AND** 若 post-deploy preflight 成功，返回 deploy 成功并可异步调度 auto ensure
- **AND** 若 post-deploy preflight 失败，返回 `post-deploy-preflight` 失败且不调度 auto ensure

### Requirement: Runtime Actions SHALL Be Mutually Exclusive
任意时刻 MUST 仅允许一个本地 runtime 动作 in-flight，后续动作请求 SHALL 被拒绝并返回冲突原因。

#### Scenario: Concurrent action denied
- **WHEN** 任一动作已在执行中
- **AND** 用户触发另一动作
- **THEN** 系统 SHALL 拒绝后续动作
- **AND** 返回互斥冲突告警

### Requirement: Button Availability SHALL Follow State Gate Matrix
按钮可用性 MUST 与状态机门禁一致。

#### Scenario: Running state gate
- **WHEN** 当前状态为 `running`
- **THEN** `停止` SHALL 可用
- **AND** `一键部署/启动` 与 `卸载` SHALL 不可用

#### Scenario: Background auto-start startup gate
- **WHEN** 后台 auto ensure 处于启动链路（`up` 未返回）
- **THEN** 系统 SHALL 视为 runtime action in-flight
- **AND** `一键部署/启动`、`停止`、`卸载` SHALL 全部不可用

#### Scenario: No-runtime-info gate
- **WHEN** 当前状态为 `no_runtime_info`
- **THEN** `卸载` SHALL 不可用

### Requirement: Debug Console Action SHALL Remain Always Available
调试控制台入口 MUST 保持可用，不受运行态门禁与动作互斥限制。

#### Scenario: Debug console during runtime actions
- **WHEN** 本地运行时动作处于 in-flight
- **THEN** 用户仍 SHALL 可以触发 `open debug console`
- **AND** 该动作 SHALL NOT 阻塞 one-click/stop/uninstall 状态收敛

#### Scenario: Debug console does not overwrite runtime status text
- **WHEN** 用户触发 `open debug console`
- **THEN** 系统 SHALL NOT 写入 runtime 状态栏 working/success/fail 文本
- **AND** runtime 状态栏 SHALL 继续由 one-click/stop/uninstall 结果驱动

### Requirement: Start and Stop Chains SHALL Follow Lease-First Contract
启动与停止链路 MUST 统一使用 lease-first 合同。

#### Scenario: Start chain
- **WHEN** preflight 成功并触发启动
- **THEN** 系统 SHALL 执行 `up` 后执行 `lease acquire`
- **AND** 系统 MUST NOT 使用 `require` 术语描述该步骤

#### Scenario: Manual stop chain
- **WHEN** 用户触发手动停止
- **THEN** 系统 SHALL 执行 `lease release -> down`
- **AND** down 后 SHALL 执行一轮 status 探测

#### Scenario: Manual stop immediately disables auto-start
- **WHEN** 用户触发手动停止
- **THEN** 系统 SHALL 立即关闭 auto-start 会话开关
- **AND** 该动作 SHALL NOT 依赖 stop 最终成功与否

### Requirement: Auto-Start Switch SHALL Be Driven by Preflight Outcomes
自动拉起开关 MUST 由 preflight 成败驱动，且自动与手动路径均适用。

#### Scenario: Preflight success enables auto-start
- **WHEN** 存在 runtime info 且任意一次 preflight 成功
- **THEN** 系统 SHALL 开启自动拉起

#### Scenario: Preflight failure disables auto-start
- **WHEN** 存在 runtime info 且任意一次 preflight 失败
- **THEN** 系统 SHALL 关闭自动拉起

#### Scenario: No runtime info keeps auto-start off
- **WHEN** 不存在 runtime info
- **THEN** 自动拉起 SHALL 保持关闭

### Requirement: Startup Behavior SHALL Run Deterministic Preflight Policy
插件启动时 MUST 使用固定初始策略，避免隐式动作漂移。

#### Scenario: Startup with runtime info
- **WHEN** 插件启动且存在 runtime info
- **THEN** 自动拉起初始值 SHALL 为关闭
- **AND** 系统 SHALL 执行一次 preflight
- **AND** preflight 结果 SHALL 参与自动拉起切换规则

#### Scenario: Startup without runtime info
- **WHEN** 插件启动且不存在 runtime info
- **THEN** 系统 SHALL 不执行 runtime 相关动作

### Requirement: Monitoring Lifecycle SHALL Be Explicitly Bound to Runtime State
运行态监测启停 MUST 明确受状态机控制。

#### Scenario: Monitoring starts after up success
- **WHEN** `up` 返回成功
- **THEN** 系统 SHALL 开启运行态监测

#### Scenario: Monitoring stops on stopped state
- **WHEN** 状态进入 `stopped`
- **THEN** 系统 SHALL 停止监测
- **AND** 仅在后续手动或自动 `up` 成功后才可重新开启

#### Scenario: Background auto-start triggers preferences state refresh
- **WHEN** 后台 auto ensure / heartbeat 收敛导致本地运行时状态变化
- **THEN** 系统 SHALL 发布状态变更通知
- **AND** 设置页 SHALL 通过 `stateSkillRunnerLocalRuntime` 快照刷新状态摘要与按钮门禁

### Requirement: Heartbeat Failure Reconciliation SHALL Use Status Polling with Heartbeat Override
heartbeat 失败后的收敛 MUST 采用 status 轮询与 heartbeat 并行机制。

#### Scenario: Heartbeat fails and status shows stopped
- **WHEN** heartbeat 失败后执行 status 探测
- **AND** status 结果为 `stopped`
- **THEN** 系统 SHALL 收敛为 `stopped`

#### Scenario: Heartbeat fails and status shows running
- **WHEN** heartbeat 失败后执行 status 探测
- **AND** status 结果为 `running`
- **THEN** 系统 SHALL 启动持续间隔 status 轮询，直到 status 变为 `stopped`

#### Scenario: Heartbeat success interrupts status polling
- **WHEN** 系统处于 heartbeat-fail 后的 status 轮询期
- **AND** 下一轮 heartbeat 成功
- **THEN** 系统 SHALL 立即停止 status 轮询
- **AND** 收敛回 `running`

#### Scenario: Heartbeat failure during status polling
- **WHEN** 系统处于 heartbeat-fail 后的 status 轮询期
- **AND** 下一轮 heartbeat 失败
- **THEN** 系统 SHALL 发布 warning
- **AND** status 轮询 SHALL 继续

#### Scenario: Single status poller invariant
- **WHEN** 系统处于 heartbeat-fail 收敛流程
- **THEN** 同时 SHALL 仅存在一个 status 轮询器

### Requirement: Runtime Info SHALL Be Persisted and Bound to Managed Backend Context
runtime info MUST 持久化并绑定托管后端上下文。

#### Scenario: Deploy and uninstall update runtime info lifecycle
- **WHEN** 新部署完成
- **THEN** 系统 SHALL 覆盖旧 runtime info
- **AND** 当卸载开始时系统 SHALL 立即清空 runtime info（与卸载最终成功与否无关）

#### Scenario: Missing ctl script with runtime info
- **WHEN** 存在 runtime info 且执行 `skill-runnerctl` 时脚本缺失
- **THEN** 系统 SHALL 直接报错并展示可见错误信息

#### Scenario: Managed binding isolation
- **WHEN** runtime info 与托管后端并存
- **THEN** runtime info SHALL 独立于普通 backend 配置覆盖链
- **AND** 用户手动添加同地址同端口 backend SHALL 视为可忽略场景

