# Zotero-Skills 开发指南（当前实现）

本文档只描述“已经实现并在代码中生效”的架构与约束。

## 1. 开发流程

- 使用 TDD：先写测试，再实现
- 改动后至少执行类型检查
- 交付前执行 Zotero 环境回归测试

## 2. 测试入口

- `npm run test`：Zotero lite
- `npm run test:full`：Zotero full
- `npm run test:node`：Node lite
- `npm run test:node:full`：Node full

`lite/full` 具体规则见 `doc/testing-framework.md`。

## 3. 核心组件（当前）

- `src/modules/selectionContext.ts`：选择上下文构建
- `src/workflows/*`：workflow 加载与请求构建
- `src/backends/*`：backend profile 读取与解析
- `src/providers/*`：provider 执行层
- `src/jobQueue/manager.ts`：任务队列
- `src/modules/workflowExecute.ts`：执行主链路
- `src/modules/*Dialog.ts`：设置/任务管理窗口

说明：`src/transport/` 当前未启用，网络逻辑在 provider 内部实现。

## 4. Backends 配置模型

不再使用文件型 `backends.json` 作为运行时主配置。当前使用：

- prefs key：`backendsConfigJson`
- 管理入口：Backend Manager 窗口

配置结构（示意）：

```json
{
  "backends": [
    {
      "id": "skillrunner-local",
      "type": "skillrunner",
      "baseUrl": "http://127.0.0.1:8030",
      "auth": { "kind": "none" },
      "defaults": { "timeout_ms": 600000 }
    }
  ]
}
```

约束：

- 整体 JSON 非法：阻断 workflow 执行
- 单条 backend 非法：仅影响绑定该 backend/provider 的 workflow

## 5. Workflow 声明模型

当前 manifest 关键字段：

- `id`, `label`, `provider`, `hooks.applyResult`（核心）
- `inputs`（声明式一阶筛选）
- `request`（声明式请求）
- `parameters`（workflow 参数 schema）
- `execution` / `result`（执行与返回约束）

已废弃字段（出现即非法）：

- 顶层 `backend`, `defaults`
- `request.result`
- `request.create.engine/model/parameter/runtime_options`

## 6. Provider 模型

当前内置 provider：

- `skillrunner`
- `generic-http`

Provider 解析逻辑：

- `requestKind + backend.type` 匹配

Provider runtime options：

- 由 provider 自身声明 schema
- workflow settings 可配置 persisted/run-once 两套参数
- skillrunner 支持 `engine/model/no_cache`（model 随 engine 动态刷新）

## 7. 执行链路

1. 从当前选择构建 `SelectionContext`
2. `executeBuildRequests` 产生每个合法输入单元的 request
3. 解析 workflow execution context（backend/profile/options）
4. JobQueue 执行 provider
5. 根据 provider 结果调用 `applyResult`
6. 汇总 succeeded/failed/skipped 消息

## 8. 任务管理窗口

当前能力：

- 展示任务名、workflow、状态
- 打开窗口时清理已完成任务

当前不支持：

- 取消任务
- 日志/产物详情查看

## 9. 文档索引

- 架构总览：`doc/architecture-flow.md`
- Workflows：`doc/components/workflows.md`
- Providers：`doc/components/providers.md`
- UI Shell：`doc/components/ui-shell.md`
- Mock：`doc/components/zotero-mock.md`
- 测试：`doc/testing-framework.md`
