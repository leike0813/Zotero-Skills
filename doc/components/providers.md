# Providers 组件说明

## 目标

提供“协议适配层”，将 step-based RequestSpec 转换为实际请求执行流程，并统一输出 RunResult。

## 职责

- 根据 requestSpec.kind 与 backend.type 选择 Provider
- 执行 Backend-level 输入/输出校验
- 将 steps 交给 Transport 执行并聚合结果
- 统一状态映射与错误处理

## 输入

- `RequestSpec`（buildRequest 生成）
- `BackendConfig`（base_url/auth/defaults）
- `Transport`（HTTP/上传/下载能力）

## 输出

- `RunResult`（包含状态、bundle/result 位置、错误）

## ProviderRegistry

```
ProviderRegistry {
  register(kind: string, provider: Provider)
  resolve(requestSpec.kind, backend.type): Provider
}
```

## GenericProvider（M1）

- kind: `http.steps`
- 执行 step-based RequestSpec
- 不内置业务逻辑，仅负责协议编排

## 行为与边界

- Provider 不处理业务落库（交给 applyResult/Handlers）
- Provider 不直接读写 UI
- Provider 与 Transport 解耦，便于未来扩展

## 测试点（TDD）

- ProviderRegistry 选择逻辑
- steps 执行顺序与变量替换
- 失败步骤的错误映射与停止策略
