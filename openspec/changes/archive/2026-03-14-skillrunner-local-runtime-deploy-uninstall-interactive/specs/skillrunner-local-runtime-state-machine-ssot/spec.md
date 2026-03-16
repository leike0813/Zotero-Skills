## ADDED Requirements

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
