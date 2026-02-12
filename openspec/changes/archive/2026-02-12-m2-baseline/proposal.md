## Why

当前项目已经达到 M2 阶段，并且已经有一批可运行的基础实现（工作流加载/执行、Provider 适配、结果回写、任务运行态与 UI 入口）。  
但这些实现尚未形成一套可追溯、可复用、可演进的 OpenSpec 基线定义，导致后续变更难以统一对齐。

## What Changes

- 新增 `m2-baseline` 变更，用于把当前 M2 的“已存在实现”固化为正式能力规格（baseline）。
- 以 capability 粒度建立规范：
  - `selection-context`
  - `provider-adapter`
  - `workflow-execution-pipeline`
  - `result-apply-handlers`
  - `task-runtime-ui`
- 该变更以“基线建模与对齐”为目标，不引入新的业务功能。

## Capabilities

### New Capabilities

- `m2-baseline`: 定义 M2 阶段能力边界、术语和验收约束。
- `selection-context`: 定义选择集重建、结构化输出与输入裁剪语义。
- `provider-adapter`: 定义 requestKind + backend.type 的 Provider 解析与执行语义。
- `workflow-execution-pipeline`: 定义 workflow 的加载、编译、执行与结果汇总流程。
- `result-apply-handlers`: 定义 `applyResult` 与 handlers 的职责边界及回写语义。
- `task-runtime-ui`: 定义任务状态模型与 UI 展示/清理行为。

### Modified Capabilities

- （无）

## Impact

- OpenSpec：新增 `m2-baseline` change 的 proposal/design/tasks/specs。
- 后续所有 feature change（例如新 provider、新 workflow）将以该 baseline 为前置约束。
- 本 change 不直接变更运行时代码与用户行为。
