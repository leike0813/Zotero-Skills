## Context

插件当前仅支持手工配置 SkillRunner backend profile，缺少“安装-启动-配置-保活”一体化入口。  
目标是以插件托管 profile 为边界，保证本地运行态尽可能自愈，同时避免污染非托管 profile 与现有 provider 语义。

约束：

- 仅支持 local mode，不实现 docker 控制。
- 本次入口位于 Preferences，不改 Backend Manager 主流程入口。
- 运行态必须以后端状态为准，插件只负责 bootstrap 与托管生命周期。

## Goals / Non-Goals

**Goals**

- 一键完成本地 SkillRunner 的下载、安装、启动与 profile 写入。
- 为托管 profile 提供按需 ensure-up 与 lease 保活（acquire/heartbeat/release）。
- 在不破坏现有执行链前提下，保证非托管 profile 行为不变。
- 提供手动命令复制回退能力，支持失败时快速复现与排障。

**Non-Goals**

- 不实现 docker 相关命令与 UI。
- 不自动覆盖冲突的 `skillrunner-local` profile。
- 不改后端 API 协议。

## Decisions

### Decision 1: 本地 runtime 托管状态独立持久化

- 选择：新增 `skillRunnerLocalRuntimeStateJson`，独立记录托管 backendId、ctl 信息、lease 状态与更新时间。
- 原因：避免污染 `backendsConfigJson` 主结构，降低兼容风险。

### Decision 2: 执行链仅在 SkillRunner 托管 profile 上触发 ensure-up

- 选择：`SkillRunnerProvider.execute` 前调用 `ensureManagedLocalRuntimeForBackend(backend.id)`。
- 原因：执行前最接近真实需求，且能保证非托管 profile 不受影响。

### Decision 3: 插件侧原生安装链 + ctl 桥接

- 选择：插件侧原生实现 `GitHub Release 下载 -> SHA256 校验 -> tar 解包`，`skillRunnerCtlBridge` 仅负责 `skill-runnerctl` 与系统命令执行归一化。
- 原因：`reference/Skill-Runner` 仅作为参考源码，不应作为运行时执行入口。

### Decision 4: 放弃外部调试终端分支

- 选择：`Deploy & Configure` 固定走插件内命令执行链，不再尝试自动拉起外部终端。
- 原因：Zotero 运行时下外部窗口拉起稳定性与可观测性不足，无法作为产品能力保证。

### Decision 5: lease 生命周期跟随插件进程

- 选择：首次 ensure-up 后 `acquire`，`heartbeat` 周期优先使用 `acquire` 返回的 `heartbeat_interval_seconds`（默认回退 20s），插件 shutdown 时 `release`。
- 异常语义：
  - heartbeat 404：自动 re-acquire。
  - lease 409：停止 lease 流程并记录告警。

### Decision 6: 部署链路采用“下载/校验/解包事实”契约且不做源码热修

- 选择：以插件侧下载/校验/解包证据作为安装成功判定，不再依赖 reference installer 回显解析。
- 选择：部署主链路固定为 `release install -> ctl bootstrap -> bootstrap report -> up -> status`，不再额外执行 `ctl install`。
- 选择：bootstrap 报告路径以 `ctl bootstrap` 返回的 `details.bootstrap_report_file` 为单一真源；字段缺失、路径不存在或不可解析直接失败，不回退 `<installDir>/data/agent_bootstrap_report.json`。
- 选择：插件不再对已安装 Skill-Runner 发布目录做任何源码补丁。
- 原因：后端已修复 Windows 依赖与启动脚本，插件保持“执行与观测”职责边界，避免跨仓补丁漂移。

### Decision 7: 运行端点以后端返回为准（动态端口）

- 选择：插件默认请求端口 `29813`，`port-fallback-span=10`（`29813~29823`）。
- 选择：每次 `ctl up/status` 后读取 `host/port/url/requested_port/port_fallback_*`，并回写托管状态与 profile。
- 选择：历史配置不做一次性迁移；仅新部署进入新端口策略。
- 原因：后端已支持端口回退并返回实际端点，插件应以返回值作为 SSOT，避免硬编码漂移。

### Decision 8: 卸载入口接入插件托管流程

- 选择：Preferences 新增 `Uninstall`，调用发布包内 `skill-runner-uninstall.ps1/.sh --json`。
- 选择：默认 `clear_data=false`、`clear_agent_home=false`。
- 选择：卸载成功后自动移除托管 profile `skillrunner-local` 并清空托管状态；失败保留状态用于诊断。
- 原因：将“部署-运行-卸载”形成闭环，降低手工残留配置风险。

## Architecture

### Modules

- `skillRunnerCtlBridge`
  - 负责命令执行：ctl bootstrap/install/up/down/status/doctor + 系统命令（如 `tar`）。
  - 优先 `Zotero.Utilities.Internal.subprocess`，Node 环境 fallback `execFile`（测试可注入）。
  - 统一输出：`ok/exitCode/message/details/stdout/stderr`。

- `skillRunnerReleaseInstaller`
  - 负责 release 资产下载、SHA256 校验、解包与解包结果校验。
  - 输出安装证据（下载文件路径/字节数、checksum expected/actual、解包目标与关键文件存在性）。

- `skillRunnerLocalRuntimeManager`
  - 负责编排 `Deploy & Configure` 固定流程（含 bootstrap report 消费）、冲突策略、状态持久化。
  - 管理 lease 定时器与 release。
  - lease 请求体遵循合同：`acquire(owner_id/metadata)`、`heartbeat/release(lease_id)`。
  - 暴露 API：`deployAndConfigureLocalSkillRunner/getLocalRuntimeStatus/stopLocalRuntime/runLocalDoctor/ensureManagedLocalRuntimeForBackend/releaseManagedLocalRuntimeLeaseOnShutdown`。

- Preferences integration
  - `preferenceScript.ts` 绑定新控件事件。
  - `hooks.ts` 分发到 runtime manager 并回写状态文案。

## Risks / Trade-offs

- [Risk] 系统环境缺少 `tar` 或网络受限导致 release 安装失败  
  → Mitigation: `doctor` 与错误详情可视化，失败不覆盖现有 profile。

- [Risk] lease 失败导致托管状态与后端运行态不一致  
  → Mitigation: 409 停止 lease 并告警，404 自动重获；不抛硬错误中断任务。

- [Risk] 误伤用户自定义 `skillrunner-local`  
  → Mitigation: 固定冲突中止策略，不自动覆盖。

## Migration Plan

1. 新增 prefs 与 UI 入口（默认版本、状态展示）。
2. 增加桥接与 runtime manager，并接入 hooks。
3. 在 SkillRunner provider 执行前接入 ensure-up（托管限定）。
4. 补齐测试并验证 strict spec。
