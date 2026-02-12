## Why

现有 workflow 基本通过远端后端（或通用 HTTP）执行请求。  
但对于“仅在 Zotero 本地即可完成”的操作（如简单元数据修订、Note 内容改写、选择集局部处理），强制走远端会增加复杂度与依赖。

因此需要新增一个本地执行型 provider：`pass-through`。

## What Changes

- 新增 `pass-through` provider，执行模式为“请求透传 + 本地 applyResult 处理”。
- 固定 request kind：`pass-through.run.v1`。
- 对 `pass-through` workflow 注入完整 `selectionContext` 到 `runResult.resultJson`，供 `applyResult` 直接消费。
- 允许 `provider=pass-through` 的 workflow 在最小模式下不声明 `hooks.buildRequest` 和 `request`。
- 保持与现有 provider 架构兼容（统一 ProviderExecutionResult、统一运行时入口）。

## Capabilities

### New Capabilities

- `pass-through-provider`: 支持在本地执行工作流，不依赖远端后端。

### Modified Capabilities

- `provider-adapter`（from `m2-baseline`）：增加 `pass-through` 类型解析与执行分支。
- `workflow-execution-pipeline`（from `m2-baseline`）：增加 pass-through 最小请求构建与本地结果注入语义。

## Dependencies

- 该 change 依赖 `m2-baseline` 的能力定义与术语边界。

## Impact

- `src/providers/`：新增 `pass-through` provider。
- `src/providers/contracts.ts`：新增 `pass-through.run.v1` request 合同。
- `src/providers/registry.ts`：注册新 provider。
- `src/workflows/runtime.ts` / `src/workflows/declarativeRequestCompiler.ts`：补充 pass-through 的请求编译与执行路径。
- `test/zotero/`：新增 pass-through provider 与 workflow 兼容性测试。
- OpenSpec：新增 `pass-through-provider` capability 规格与任务。
