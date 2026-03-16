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
自动拉起开关 MUST 由 preflight 成败驱动，且自动与手动路径均适用；开关状态 SHALL 持久化到 runtime state。

#### Scenario: Preflight success enables auto-start and persists
- **WHEN** 存在 runtime info 且任意一次 preflight 成功
- **THEN** 系统 SHALL 开启自动拉起
- **AND** 系统 SHALL 持久化 `autoStartPaused=false`

#### Scenario: Preflight failure disables auto-start and persists
- **WHEN** 存在 runtime info 且任意一次 preflight 失败
- **THEN** 系统 SHALL 关闭自动拉起
- **AND** 系统 SHALL 持久化 `autoStartPaused=true`

#### Scenario: Manual stop disables auto-start and persists
- **WHEN** 用户触发手动停止
- **THEN** 系统 SHALL 立即关闭自动拉起
- **AND** 系统 SHALL 持久化 `autoStartPaused=true`

### Requirement: Startup Behavior SHALL Run Deterministic Preflight Policy
插件启动时 MUST 先从持久化状态恢复自动拉起开关，再按开关执行 startup preflight。

#### Scenario: Startup hydrates persisted auto-start state
- **WHEN** 插件启动
- **THEN** 系统 SHALL 从 `skillRunnerLocalRuntimeStateJson.autoStartPaused` 恢复自动拉起会话开关
- **AND** 若该字段缺失，系统 SHALL 视为自动拉起关闭

#### Scenario: Startup preflight runs only when persisted auto-start is enabled
- **WHEN** 插件启动且持久化自动拉起状态为开启
- **THEN** 系统 SHALL 执行一次 startup preflight

#### Scenario: Startup preflight skips when persisted auto-start is disabled
- **WHEN** 插件启动且持久化自动拉起状态为关闭
- **THEN** 系统 SHALL 跳过 startup preflight
- **AND** 系统 SHALL 返回可观测的 skip stage

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

### Requirement: One-Click Action SHALL Support Plan-Then-Execute Branching
一键部署/启动动作 MUST 先完成分支预判，再执行对应分支；仅 deploy 分支需要用户确认后执行。

#### Scenario: Runtime info present and preflight success selects start
- **WHEN** 调用 one-click 预判且 runtime info 存在且 preflight 成功
- **THEN** 系统 SHALL 返回 `plannedAction=start`
- **AND** one-click 执行 SHALL 仅执行 start 分支，不回退 deploy

#### Scenario: Runtime info missing or preflight failure selects deploy
- **WHEN** 调用 one-click 预判且 runtime info 缺失，或 preflight 失败
- **THEN** 系统 SHALL 返回 `plannedAction=deploy`
- **AND** 系统 SHALL 返回安装目录说明用于确认弹窗渲染

#### Scenario: Deploy branch requires explicit confirmation
- **WHEN** one-click 预判结果为 deploy
- **THEN** 系统 SHALL 等待用户确认后再执行 deploy
- **AND** 用户取消时系统 SHALL 不执行 deploy 链路

### Requirement: Local Runtime Actions SHALL Expose Progress Snapshot
deploy/uninstall 动作 MUST 通过 snapshot 暴露进度状态，供设置页 progressmeter 渲染。

#### Scenario: Deploy reports five-step progress
- **WHEN** 执行 deploy 分支
- **THEN** 系统 SHALL 依次推进 5 个步骤进度（probe / download-checksum / extract / bootstrap / post-bootstrap）
- **AND** 每次推进 SHALL 更新 `details.actionProgress`

#### Scenario: Uninstall reports down-directory-profile progress
- **WHEN** 执行 uninstall
- **THEN** 系统 SHALL 在 down 完成后推进一步（若 down 可执行）
- **AND** 每个实际删除目录完成后推进一步
- **AND** profile 清理完成后推进最后一步

### Requirement: Uninstall SHALL Provide Preview Before Execution
uninstall 执行前 MUST 支持预览删除/保留目录集合与步骤总数。

#### Scenario: Preview returns removable and preserved targets
- **WHEN** 调用 uninstall 预览接口并给定 clearData/clearAgentHome 选项
- **THEN** 系统 SHALL 返回 `removableTargets` 与 `preservedTargets`
- **AND** 系统 SHALL 返回 `totalSteps` 与 `canInvokeDown`

### Requirement: Windows Uninstall Delete Chain SHALL Harden Long-Path and Retry
Windows 下卸载删除链路 MUST 对深路径与临时占用提供兜底，同时保持“删除失败即卸载失败”语义。

#### Scenario: Npm cache delete retries and long-path fallback
- **WHEN** Windows 环境下删除 `agent-cache/npm` 发生可重试错误（如 `EPERM/EBUSY/ENOTEMPTY/ENAMETOOLONG`）
- **THEN** 系统 SHALL 进行短重试并在需要时尝试长路径删除兜底
- **AND** 若目录最终仍存在，系统 SHALL 返回 `stage=uninstall-delete` 且 `ok=false`

### Requirement: Local runtime control plane MUST be bridge-native

Local runtime lifecycle actions MUST be implemented by plugin bridge native methods instead of runtime dependency on `skill_runnerctl` command returns.

#### Scenario: deploy bootstrap uses bridge-native bootstrap

- **WHEN** local deploy enters bootstrap stage
- **THEN** plugin MUST execute bridge-native bootstrap action
- **AND** plugin MUST validate bootstrap report via inferred report path when payload path is absent

#### Scenario: ensure/start/stop/status/doctor use bridge-native actions

- **WHEN** manager executes local runtime action chain
- **THEN** manager MUST call bridge-native local actions for `preflight/up/down/status/doctor`
- **AND** manager MUST NOT require ctl JSON payload as runtime source of truth

#### Scenario: up action owns state file lifecycle

- **WHEN** bridge-native up starts runtime successfully
- **THEN** bridge MUST write local runtime state file with pid/host/port metadata
- **AND** bridge MUST wait for health before returning success
- **AND** timeout MUST terminate process and clear state file

