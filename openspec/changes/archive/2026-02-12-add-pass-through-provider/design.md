## Context

在 M2 baseline 中，workflow 执行链路已成形，但主要面向“有后端通信”的 provider。  
为了把插件扩展成通用框架，需要一类“纯本地执行” provider：

1. 复用统一 workflow/runtime/provider 架构  
2. 不发起任何远端调用  
3. 将选择上下文交由本地 `applyResult` 自定义处理

## Goals / Non-Goals

**Goals:**

- 在统一 provider 架构内引入 `pass-through`。
- 对声明式工作流提供最小可用路径（零远端依赖）。
- 保证与现有 provider 行为兼容，不破坏主流程。

**Non-Goals:**

- 不引入新的远端协议。
- 不在本 change 中实现具体业务 workflow（如 reference-matching）。
- 不修改 handlers 的职责边界。

## Decisions

### Decision 1: 请求类型固定

- `pass-through` 的 request kind 固定为 `pass-through.run.v1`。
- 不引入版本别名或多 kind 并行，降低协议复杂度。

### Decision 2: 始终注入完整 Selection Context

- 不提供 `include_selection_context` 开关。
- `runResult.resultJson` 始终包含完整 `selectionContext`。

### Decision 3: 兼容最小 workflow 声明

- 当 `provider=pass-through` 时，允许不写 `hooks.buildRequest` 与 `request`。
- runtime/compiler 提供最小请求补全逻辑，保持声明简洁。

### Decision 4: 本地虚拟 backend 上下文

- `pass-through` 不要求真实 backend profile。
- 执行时使用本地虚拟 backend 上下文，保持 registry/runtime 契约一致。

## Risks / Trade-offs

- 风险：本地执行 workflow 可能绕过部分后端级防护。  
  应对：保持 `applyResult`/handlers 的安全边界与错误语义。
- 风险：新增分支会增加 runtime 复杂度。  
  应对：将逻辑限制在 provider 解析和最小请求补全两个点。

## Migration Plan

1. 增加 provider 合同与注册。
2. 增加 runtime/compiler 的 pass-through 分支。
3. 补充单元与端到端测试。
4. 更新文档并验证与既有 workflow 兼容。

## Open Questions

- 本 change 无阻塞问题，后续如需更细粒度本地权限控制，再起独立 change。
