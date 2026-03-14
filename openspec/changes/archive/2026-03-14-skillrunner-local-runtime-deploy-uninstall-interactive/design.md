## Context

一键部署/启动当前实现已经具备核心链路（preflight -> up -> lease、deploy -> bootstrap -> post-preflight、uninstall plugin-side orchestration），但交互侧仍缺三类能力：

1. 执行前确认（deploy/uninstall）。
2. 执行中可观测进度（settings 内联）。
3. 执行前的结构化预判/预览能力（供 UI 编排）。

## Goals / Non-Goals

**Goals**

- one-click 动作拆分为“预判 + 执行”，并仅在 deploy 分支弹确认。
- uninstall 动作拆分为“选项确认 + 最终确认 + 执行”。
- 在设置页显示 deploy/uninstall 分步进度，且状态来源唯一（runtime manager snapshot）。

**Non-Goals**

- 不改 dashboard 入口与流程。
- 不改 one-click 的核心执行语义（含 post-deploy preflight 合同）。
- 不改对外事件名（deploy/stop/uninstall）。

## Decisions

### Decision 1: 预判与执行分离

- 新增 `planLocalRuntimeOneclick`：
  - 有 runtime info 且 preflight ok -> `plannedAction=start`
  - 其他情况 -> `plannedAction=deploy`，并返回 `installLayout`
- `deployAndConfigureLocalSkillRunner` 新增 `forcedBranch`，由 UI 预判结果驱动：
  - `start` 分支只做 start，不再回退 deploy。
  - `deploy` 分支直接进入 deploy。

### Decision 2: 卸载预览与双确认

- 新增 `previewLocalRuntimeUninstall(clearData, clearAgentHome)` 返回：
  - `removableTargets`
  - `preservedTargets`
  - `canInvokeDown`
  - `totalSteps`
- UI 先收集选项，再基于 preview 内容做最终确认。

### Decision 3: 进度 SSOT 放在 runtime manager

- 新增 `actionProgress` 内存态并写入 snapshot：
  - `action/current/total/percent/stage/label`
- deploy 步骤等分 5 步：
  1. release probe
  2. download + checksum
  3. extract
  4. bootstrap
  5. post-bootstrap finalize
- uninstall 步骤等分：
  - down（若可执行）
  - 每个实际删除目录
  - profile 清理

### Decision 4: release installer 提供可选进度回调

- 在 `installSkillRunnerRelease` 增加可选 `onProgress(stage)`：
  - `download-checksum-complete`
  - `extract-complete`
- 不改变安装结果语义与错误语义。

## Risks / Trade-offs

- [Risk] settings 弹窗能力有限，卸载第一步无法原生多选框。  
  → Mitigation: 采用“第一步选项问答 + 第二步最终确认”的可组合交互，保持行为正确性与可测性。

- [Risk] actionProgress 清理时机导致“100%瞬时消失”。  
  → Mitigation: 进度用于 in-flight 可观测，不承诺完成后保留；最终结果仍由 status text 承载。

- [Risk] 新增内部事件增加 hooks 分支复杂度。  
  → Mitigation: 仅新增 `plan/preview` 两个事件，保持 execute 事件名不变。
