# workflow-duplicate-job-submission-guard Specification

## Purpose
Prevent silent duplicate submission when the same workflow is triggered again for the same input unit while an earlier job is still running.

## Requirements
### Requirement: 系统必须在提交前检测运行中重复 job

系统 MUST 在 job 提交前检测是否存在“同 workflow + 同输入单元”的运行中任务。  
仅运行中任务（queued/running）参与重复判定；已结束任务不参与。

#### Scenario: 检测到运行中重复 job

- **WHEN** 用户触发 workflow，且某待提交 job 与运行中任务具有相同 workflow 与输入单元身份
- **THEN** 系统 MUST 将该 job 标记为“重复候选”，进入用户确认流程
- **AND** 系统 MUST NOT 直接提交该 job 到后端

### Requirement: 系统必须对重复候选 job 提供显式确认并默认拒绝

对每一个重复候选 job，系统 MUST 弹出确认对话框并展示冲突上下文。  
对话框关闭、取消、Esc 等非肯定操作 MUST 等价为“否”。

#### Scenario: 用户拒绝重复提交

- **WHEN** 用户对重复候选 job 选择“否”或关闭对话框
- **THEN** 系统 MUST 不提交该 job
- **AND** 系统 MUST 将该 job 记录为 skipped
- **AND** skipped 原因 MUST 可用于本地化显示（如 duplicate-running-job-denied）

#### Scenario: 用户明确允许重复提交

- **WHEN** 用户对重复候选 job 明确选择“是”
- **THEN** 系统 MUST 放行该 job 并继续正常提交流程

### Requirement: 系统必须按重复候选 job 串行弹出确认对话框

当一次触发包含多个重复候选 job 时，系统 MUST 逐个串行展示确认对话框。  
下一个对话框 MUST 在上一个完成决策后再展示。

#### Scenario: 一次触发中存在多个重复候选 job

- **WHEN** 用户一次触发形成多个重复候选 job
- **THEN** 系统 MUST 依次弹出多个确认对话框
- **AND** 每个对话框 MUST 等待用户决策后再进入下一个
- **AND** 仅被明确选择“是”的 job 被提交

### Requirement: 系统必须保持非重复 job 行为不变

对未命中重复的 job，系统 SHALL 维持现有提交流程，不增加额外交互阻塞。

#### Scenario: 混合输入（部分重复、部分非重复）

- **WHEN** 同一次触发中同时存在重复候选 job 与非重复 job
- **THEN** 非重复 job SHALL 按既有流程提交
- **AND** 重复候选 job SHALL 按确认结果分别提交或跳过
- **AND** 触发级摘要 MUST 正确统计 succeeded/failed/skipped
