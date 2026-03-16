## Why

当前插件日志只覆盖上层执行阶段，provider/client/transport 细节、关联链路与可共享诊断上下文不足。  
当用户提交 issue 或将日志交给 agent 排障时，常出现“信息不全、无法复现、无法关联 request/job”的问题，需要一次系统化升级。

## What Changes

- 为 runtime log pipeline 增加诊断模式（会话级开关）与跨 provider 全链路诊断字段采集。
- 扩展日志模型：补齐 backend/provider/workflow/run/job/request/interaction 关联上下文、组件操作语义、传输追踪摘要与错误分类。
- 引入 `RuntimeDiagnosticBundleV1` 导出协议（JSON），支持 issue 与 agent 直接消费。
- 增加 `Copy Diagnostic Bundle JSON` 与 `Copy Issue Summary`（Markdown）能力。
- 在日志窗口新增预算与脱敏状态提示；在 Dashboard backend 日志区增加“跳转到诊断导出”入口。
- 引入诊断模式下的双阈值保留策略（entries + byte budget），并保持常规模式与现有行为兼容。

## Capabilities

### New Capabilities

- `runtime-diagnostic-bundle`: 定义可共享、可机器消费的诊断包与 issue 摘要导出契约（结构、脱敏、聚合、筛选）。

### Modified Capabilities

- `runtime-log-pipeline`: 扩展日志条目模型、采集链路、错误分类、诊断模式与导出构建能力。
- `log-viewer-window`: 增加诊断模式开关、诊断包复制、issue 摘要复制与预算/脱敏可视化。
- `log-retention-control`: 更新为“持久化 + 模式化预算”规则，新增诊断模式双阈值淘汰语义。
- `task-runtime-ui`: Dashboard backend 日志区增加跳转诊断导出的入口行为。

## Impact

- 主要代码变更：
  - `src/modules/runtimeLogManager.ts`
  - `src/modules/logViewerDialog.ts`
  - `src/modules/taskManagerDialog.ts`
  - `addon/content/dashboard/app.js`
  - provider/client/queue/reconciler 日志埋点相关模块
- 主要新增能力：
  - `buildRuntimeDiagnosticBundle(...)`
  - issue 摘要构建与复制能力
  - 诊断模式运行时开关与预算守护
- 主要测试变更：
  - runtime log manager、log viewer、workflow/provider instrumentation 回归扩展
  - 诊断包 schema、脱敏、预算与链路聚合用例
