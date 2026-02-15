## Context

当前 workflow 触发流程会将输入集合拆分为多个 job 并直接进入提交/执行。  
系统已具备任务运行态记录与执行反馈能力，但在“提交前”缺少对运行中重复 job 的拦截与用户确认环节。

这导致以下风险：

- 同一输入被并发重复提交到后端；
- 结果回写阶段可能出现覆盖、重复附件、状态竞争；
- 用户无法感知“已有同任务在跑”。

## Goals / Non-Goals

**Goals**

- 在 job 提交前检测“同 workflow + 同输入单元”的运行中重复。
- 对重复 job 弹出确认对话框，默认拒绝，关闭等价拒绝。
- 对一次触发中的多个重复 job，按序逐个确认。
- 仅显式“是”放行提交；其余标记为跳过并进入结果汇总。

**Non-Goals**

- 引入全局分布式锁或跨进程去重。
- 阻断不同 workflow 对同输入的并行执行。
- 改变非重复 job 的现有执行与反馈行为。

## Decisions

### Decision 1: 采用“workflowId + inputUnitIdentity”作为重复判定键

- 重复定义：`workflowId` 相同且 `inputUnitIdentity` 相同。
- `inputUnitIdentity` 由统一规则生成，优先使用稳定业务标识（如 attachment itemKey/itemID/绝对路径、parent itemKey 等），避免使用瞬时 runId/jobId。
- 仅与“运行中任务集合”（queued/running）比对；已结束任务不参与重复判断。

### Decision 2: 在提交前引入重复筛查与决策阶段

- 在真正调用提交执行前，先对候选 job 执行重复检测。
- 对未命中重复的 job：直接放行。
- 对命中重复的 job：进入用户确认队列。

### Decision 3: 重复确认对话框采用串行阻塞式决策

- 一次仅展示一个重复 job 的确认对话框。
- 用户完成当前对话框选择后，才展示下一个重复 job 的对话框。
- 对话框需展示：
  - workflow 名称/标识；
  - 当前输入单元可读标识；
  - 已在运行的重复任务标识（至少一个）。

### Decision 4: 默认拒绝策略

- 默认按钮为“否”。
- 用户关闭窗口、Esc、取消等均按“否”处理。
- 仅当用户明确点击“是”时，job 才进入提交队列。

### Decision 5: 被拒绝的重复 job 进入 skipped 结果通道

- 拒绝提交的 job 不视为失败，而是以 skipped 记录。
- skipped 原因统一为“duplicate-running-job-denied”语义键，供本地化与摘要展示。
- 保持整体 trigger 级别统计口径一致（succeeded/failed/skipped）。

## Risks / Trade-offs

- [Risk] 输入单元 identity 设计不稳定导致误判  
  Mitigation: 提供集中式 identity 构建器并补充回归测试覆盖不同输入来源（父条目、附件、note）。

- [Risk] 多重复 job 串行对话框影响交互效率  
  Mitigation: 仅对命中重复的 job 弹框，非重复 job 无额外交互。

- [Risk] 运行态快照和真实状态存在瞬时竞争  
  Mitigation: 对每个待提交 job 在放行前做一次最终重复复核。

## Migration Plan

1. 引入输入单元 identity 构建与重复检测服务。
2. 在提交流水线插入“重复检测 -> 串行确认 -> 放行/拒绝”阶段。
3. 将拒绝项映射为 skipped 结果，并接入现有消息/统计体系。
4. 增补本地化文案与自动化测试。

## Acceptance Gates

- 命中重复时，提交前必弹框，且默认拒绝。
- 多重复 job 必须按顺序逐个确认，不得并发弹框。
- 仅显式“是”可提交；“否/关闭”均产生 skipped 记录。
- 非重复 job 行为与现状一致，无回归。
