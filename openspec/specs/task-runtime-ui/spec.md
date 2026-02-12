# task-runtime-ui Specification

## Purpose
TBD - created by archiving change m2-baseline. Update Purpose after archive.
## Requirements
### Requirement: 系统必须维护任务运行态模型
系统 MUST 维护任务在运行期的状态（排队、执行、完成、失败），并提供稳定标识用于查询与展示。

#### Scenario: 任务状态更新
- **WHEN** workflow 输入单元状态变化
- **THEN** 系统更新对应任务状态并保持键稳定

### Requirement: 系统必须提供任务 UI 的最小可观测能力
系统 MUST 在任务管理界面中展示核心状态信息，并支持清理已完成任务。

#### Scenario: 打开任务面板
- **WHEN** 用户打开任务管理窗口
- **THEN** 系统展示当前任务状态
- **AND** 清理已结束任务，避免历史噪音无限累积

