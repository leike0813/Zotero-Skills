## Why

当前卸载链路依赖后端发布包内的卸载脚本，跨进程参数传递与输出归一化在插件运行时不稳定，导致“误判成功/失败原因不可读/残留不可控”。  
需要将卸载编排迁移到插件侧，以插件托管状态为单一真源，保证可预测的停服、删除与状态收敛行为。

## What Changes

- 将 `Uninstall` 主流程从“调用后端卸载脚本”改为“插件内编排执行”。
- 插件卸载流程固定为：`ctl down(local)` 成功后，按 `localRoot` 受控删除运行时目录；任一步失败即终止并保留托管状态用于排障。
- 删除范围对齐现有后端脚本语义：默认保留 `data` 与 `agent-home`，其余运行时缓存与发布目录清理；勾选开关后再清理对应目录。
- 新增卸载安全闸门：`localRoot` 必须可由托管 `installDir` 安全反推并通过边界校验，否则拒绝删除。
- 卸载成功后才删除托管 backend profile 并清空托管 runtime state。

## Capabilities

### New Capabilities

- `plugin-side-skillrunner-uninstall`: 插件侧接管 SkillRunner 本地运行时卸载编排与安全删除能力。

### Modified Capabilities

- （无）

## Impact

- 主要影响模块：
  - `skillRunnerLocalRuntimeManager`（卸载编排、路径校验、删除执行、状态收敛）
  - `skillRunnerCtlBridge`（卸载脚本调用路径降级/移除主链路）
  - 卸载相关核心测试（`73/74`）
- 对外事件与 UI 入口保持不变：`uninstallSkillRunnerLocalRuntime`、`clearData/clearAgentHome`。
