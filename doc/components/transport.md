# Transport 组件说明

## 当前状态

当前版本中，`transport` 层未启用。

- `src/transport/` 目录为空
- 真实网络执行逻辑位于 Provider 内部：
  - SkillRunner：`src/providers/skillrunner/client.ts`
  - Generic HTTP：`src/providers/generic-http/provider.ts`

## 设计结论

- 现阶段不再将“传输协议”作为独立层对外暴露
- 执行协议由 Provider 决定并自行实现
- Workflow/runtime 仅依赖 Provider 抽象，不依赖 transport 细节

## 未来演进（可选）

若后续出现多个 Provider 复用同一网络执行器，再抽离通用 `transport` 层。抽离前提建议：

- 至少两个 Provider 出现明显重复的 HTTP/上传/轮询逻辑
- 抽离后不会引入额外协议耦合（例如再次固化成单一 request 形态）
