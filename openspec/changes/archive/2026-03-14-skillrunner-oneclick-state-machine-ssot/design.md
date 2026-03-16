## Context

现有本地运行时链路已经具备 deploy/preflight/up/down/lease/heartbeat 等能力，但“动作入口、状态切换、自动拉起、监测收敛”曾存在合同与实现漂移。  
本变更进入“文档 + 实现”阶段：以 SSOT 合同驱动代码收敛，并补齐对应回归测试。

约束：
- 本 change 不新增/变更对外 prefs 事件名。
- `lease acquire` 作为唯一术语，禁止再使用 `require`。
- 启动默认自动拉起关闭，行为切换由 preflight 结果驱动。

## Goals / Non-Goals

**Goals**
- 建立本地一键部署/启动状态机 SSOT，覆盖按钮动作、监测收敛、runtime info 生命周期。
- 锁定 heartbeat 失败后的收敛策略（含 status 轮询与 heartbeat 并行规则）。
- 输出可直接映射实现的守护伪代码与 violation 结构。
- 在 `doc/components` 产出正式组件设计文档，作为后续实现与评审入口。

**Non-Goals**
- 不在本 change 内新增 runtime 动作按钮或恢复旧入口。
- 不定义轮询超时上限与重试预算（后续实现 change 决策）。

## Decisions

### Decision 1: 独立 capability 作为本地状态机唯一真源
- 选择：新增 `skillrunner-local-runtime-state-machine-ssot`，承载状态、事件、转移与不变量。
- 选择：`skillrunner-local-runtime-bootstrap` 仅保留入口链路语义，并引用该真源。

### Decision 2: 按钮动作最终收敛为三动作并互斥
- 动作集合：`oneclick-deploy-start`、`stop`、`uninstall`。
- 全局约束：同一时刻仅允许一个动作 in-flight。
- 可用性约束：
  - `running` 仅允许 `stop`
  - `running` 禁用 `oneclick-deploy-start` 与 `uninstall`
  - 后台 auto ensure 进入启动链（`up` 未返回）视为 in-flight，三动作均禁用
  - `no runtime info` 禁用 `uninstall`

### Decision 3: 一键动作采用 preflight 决策分流
- 有 runtime info：`preflight -> (ok: up -> lease acquire, fail: deploy)`。
- 无 runtime info：直接 deploy。
- 一旦进入 deploy 且 deploy 成功：必须执行 post-deploy preflight 后再返回。
  - post-deploy preflight 成功：返回 deploy 成功，并异步调度 auto ensure。
  - post-deploy preflight 失败：返回 `post-deploy-preflight` 失败，不触发 auto ensure。

### Decision 4: 停止动作固定为 release 后 down，并强制 status 探测
- 手动停止流程固定：`lease release -> down`（down 保底）。
- 手动 down 后必须做一轮 status 探测并按结果收敛。
- 手动 stop 入口被触发时，auto-start 会话开关立即关闭（与 stop 成败解耦）。

### Decision 5: 自动拉起与 preflight 成败联动（自动+手动路径）
- 有 runtime info 且 preflight 成功：自动拉起开启。
- 有 runtime info 且 preflight 失败：自动拉起关闭。
- 无 runtime info：自动拉起保持关闭。

### Decision 6: 启动行为固定
- 插件启动时自动拉起初始默认关闭。
- 若存在 runtime info：执行一次 preflight，并参与自动拉起切换规则。
- 若不存在 runtime info：不执行 runtime 动作。

### Decision 7: heartbeat 失败后采用“status 轮询 + heartbeat 并行”收敛
- heartbeat fail 后先做一次 status 探测：
  - `status=stopped`：收敛 `stopped`
  - `status=running`：进入持续间隔 status 轮询
- 轮询期间 heartbeat 继续运行：
  - 下一轮 heartbeat 成功：立即停止 status 轮询，收敛 `running`
  - 下一轮 heartbeat 失败：发布 warning，status 轮询继续
- 不变量：
  - 同时仅一个 status 轮询器
  - 轮询间隔采用 heartbeat interval（缺省 20s）
  - 命中 `stopped` 或 heartbeat 成功打断后必须清理轮询状态

### Decision 8: runtime info 生命周期与绑定规则
- runtime info 必须持久化。
- 新部署覆盖旧 runtime info；卸载在入口即清空 runtime info（不依赖卸载最终成功）。
- runtime info 与托管后端绑定，不进入普通 backend 配置覆盖链。
- 有 runtime info 时执行 `skill-runnerctl` 默认视为脚本存在，缺失即抛错并可见化。

### Decision 9: 设置页状态刷新采用状态变更推送
- 本地运行时状态写入、监测状态变化、动作互斥状态变化时，发布内部状态变更通知。
- prefs 页面订阅该通知并调用 `stateSkillRunnerLocalRuntime` 快照刷新。
- 后台 auto ensure / heartbeat 收敛与手动动作统一走同源刷新入口，避免 UI 漂移。
- `open debug console` 不写入状态栏 working/success/fail 文本，避免干扰 runtime 动作状态展示。

## State Model (Contract)

### State
- `no_runtime_info`
- `runtime_info_ready`
- `preflighting`
- `deploying`
- `starting`
- `acquiring_lease`
- `running`
- `stopping`
- `reconciling_after_heartbeat_fail`
- `stopped`
- `uninstalling`
- `error`

### Event
- `oneclick_clicked`
- `preflight_ok`
- `preflight_fail`
- `deploy_ok`
- `deploy_fail`
- `up_ok`
- `up_fail`
- `lease_acquire_ok`
- `lease_acquire_fail`
- `stop_clicked`
- `lease_release_ok`
- `lease_release_fail`
- `down_ok`
- `down_fail`
- `status_running`
- `status_stopped`
- `status_error`
- `heartbeat_ok`
- `heartbeat_fail`
- `uninstall_clicked`

## Guard Draft (Pseudocode)

```ts
type Violation = {
  ruleId: string;
  stage: string;
  context: Record<string, unknown>;
  reason: string;
  severity: "info" | "warning" | "error";
};

function transitionGuard(prev: State, event: Event, ctx: Ctx): {
  next: State;
  violations: Violation[];
} {
  // Use SSOT transition table only.
}

function actionMutexGuard(inFlightAction: string | null, incomingAction: string): {
  allow: boolean;
  violation?: Violation;
} {
  // Deny when any action is already running.
}

function buttonEnablementGuard(state: State, hasRuntimeInfo: boolean, inFlight: boolean) {
  // running -> stop enabled only
  // no_runtime_info -> uninstall disabled
}

function autoStartToggleGuard(
  hasRuntimeInfo: boolean,
  preflightResult: "ok" | "fail" | "skip",
  source: "startup" | "manual" | "auto",
) {
  // No runtime info => force disabled
  // preflight ok => enable
  // preflight fail => disable
}

function monitorGuard(upResult: "ok" | "fail", currentState: State) {
  // up ok => monitoring on
  // state stopped => monitoring off
}

function reconcileAfterHeartbeatFail(ctx: {
  statusProbe: () => "running" | "stopped" | "error";
  heartbeatTick: () => "ok" | "fail";
  pollIntervalSeconds: number;
}) {
  // 1) probe status once
  // 2) if stopped => stop monitoring + stopped
  // 3) if running => start single poller
  // 4) during polling:
  //    - heartbeat ok => cancel poller, back to running
  //    - heartbeat fail => emit warning, keep polling
  //    - status stopped => stop monitoring + stopped
}
```

## Risks / Trade-offs

- 文档规则较多，若不集中引用可能与旧 spec 再次分叉。  
  → Mitigation: 强制 bootstrap spec 仅引用新 capability 的状态规则。
- heartbeat/status 并行规则复杂，后续实现可能出现竞态。  
  → Mitigation: 在合同中明确“单轮询器”与“heartbeat success 优先打断”不变量。

## Migration Plan

1. 新增独立 capability delta spec（完整状态机合同）。
2. 修改 bootstrap capability delta spec（引用新 SSOT）。
3. 新增 `doc/components/skillrunner-local-runtime-oneclick-state-machine-ssot.md`（状态机、时序图、不变量）。
4. 完成 tasks 文档并执行 strict validate。

## Implementation Notes (Current Round)

- `deploySkillRunnerLocalRuntime` 已收敛为 one-click 行为入口。
- 偏好页 runtime 按钮已收敛为 4 个：one-click / stop / uninstall / open debug console。
- `open debug console` 为显式例外：始终可用，不参与 runtime 动作互斥。
- hooks 已移除旧 prefs runtime 事件入口（status/start/doctor/copy-commands/toggle-auto-pull）。

## Open Questions

- 轮询超时上限、重试预算与告警聚合策略留给后续实现 change 决策。
