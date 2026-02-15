## Why

当前实现中，如果同一 workflow 对同一输入单元的 job 仍在运行，用户再次触发时会直接重复提交到后端。  
这会引入并发写入、重复回写、状态竞争等不可预测行为，需要在“提交前”增加显式防重复保险。

## What Changes

- 新增“重复运行中 job 提交防护”能力：在 job 提交前检测是否存在同 workflow + 同输入单元的运行中 job。
- 命中重复时弹出确认对话框，明确提示：
  - 当前输入单元标识（如条目标题/附件名/key）；
  - 正在执行的 workflow 标识。
- 默认拒绝重复提交：对话框默认焦点为“否”，关闭对话框等价于“否”。
- 若一次触发包含多个待提交 job，则对每个命中重复的 job 逐个串行询问；仅用户明确选择“是”的 job 允许继续提交。
- 对被拒绝的重复 job 记录为“跳过（用户拒绝重复提交）”，并纳入本次执行汇总。

## Capabilities

### New Capabilities

- `workflow-duplicate-job-submission-guard`: 防止同 workflow + 同输入单元在运行期间被静默重复提交，并通过逐 job 确认对话框交由用户决策。

### Modified Capabilities

- None.

## Impact

- 受影响模块：
  - workflow 执行提交前编排（pre-submit pipeline）；
  - 任务运行态查询（用于识别运行中重复 job）；
  - 交互提示与本地化文案。
- 需新增/更新测试：
  - 单 job 重复检测与弹窗决策；
  - 多 job 重复时的串行弹窗顺序；
  - “否/关闭=拒绝”与“仅显式是才放行”。
- 不涉及 provider 协议或 workflow 文件格式变更。
