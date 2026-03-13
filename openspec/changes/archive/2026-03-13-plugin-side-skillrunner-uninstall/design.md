## Context

插件当前卸载动作通过 `runUninstallCommand` 调用发布包内 `skill-runner-uninstall.ps1/.sh`，卸载结果依赖外部脚本输出契约。  
该模式在实际运行中暴露出三类问题：参数绑定偏差、输出不可预测、失败边界不清晰。  
本变更将卸载“编排职责”上移到插件，后端仅保留 `ctl down` 运行时停服能力。

约束：
- 停服必须成功，否则不执行删除。
- 删除范围与后端脚本语义一致，但删除动作由插件执行。
- `localRoot` 无法安全反推时必须失败，不允许默认根路径兜底删除。

## Goals / Non-Goals

**Goals:**
- 让卸载行为对插件可控、可测试、可诊断。
- 明确“停服 -> 删除 -> 清状态”顺序与失败边界。
- 保持现有 UI/API 入口兼容，不改变用户触发方式。

**Non-Goals:**
- 不改 deploy/start/auto-start 逻辑。
- 不引入“强制全清 localRoot”高风险语义。
- 不修改后端 `skill_runnerctl.py` 协议。

## Decisions

### Decision 1: 卸载主链路迁移为插件内编排
- 选择：`uninstallLocalRuntime` 直接调用 `runCtlCommand(down)` 与插件侧删除逻辑，不再依赖 `runUninstallCommand`。
- 原因：去除外部卸载脚本的参数/输出不稳定性，统一错误语义。
- 备选：继续修补脚本调用；被拒绝，历史故障已证明维护成本高。

### Decision 2: 停服作为硬前置条件
- 选择：`down` 返回非成功即整次卸载失败，禁止继续删除。
- 原因：避免服务仍占用文件导致半删除或状态漂移。
- 备选：失败后继续删；被拒绝，风险不可控。

### Decision 3: 删除范围镜像现有脚本语义
- 选择：默认删除 `releases`、`agent-cache/npm`、`uv_cache`、`uv_venv`；`data`/`agent-home`按开关删除。
- 原因：与现有用户预期一致，降低行为突变风险。
- 备选：仅删 `installDir`；被拒绝，无法完成运行时清理闭环。

### Decision 4: localRoot 必须可安全反推
- 选择：仅当 `installDir -> releases -> localRoot` 校验通过时允许删除；否则直接失败。
- 原因：防止误删项目目录、盘符根或非托管路径。
- 备选：回退默认本地目录；被拒绝，误删风险高。

### Decision 5: 状态收敛仅在全链成功后发生
- 选择：只有停服和删除均成功后，才移除 managed profile 并清空 runtime state。
- 原因：失败时保留诊断现场，避免“已清状态但未清文件”。

## Risks / Trade-offs

- [Risk] 插件侧删除实现与后端脚本出现语义漂移  
  → Mitigation: 在 `73` 测试中固化删除目标与开关组合断言。

- [Risk] 停服失败导致用户感知“无法卸载”  
  → Mitigation: 返回明确阶段错误（`uninstall-down`）与命令上下文，指导先排查运行态。

- [Risk] localRoot 校验过严导致历史脏状态无法卸载  
  → Mitigation: 失败时返回具体校验原因，并允许后续通过修复托管状态重试。

## Migration Plan

1. 在 runtime manager 引入插件侧卸载执行器（停服、删除、结果汇总）。
2. 将 `uninstallLocalRuntime` 切换到新执行器，保留原入口事件。
3. 将 bridge 的 `runUninstallCommand` 从主链路移除（可先保留兼容实现，不再被调用）。
4. 更新并通过 `73/74` 定向回归与类型检查。

## Open Questions

- 无（本次关键策略已锁定）。
