## Context

当前代码存在两个不对齐点：

1. `execution.mode` 已承载插件历史语义，不能直接覆写为 SkillRunner 执行模式。
2. SkillRunner runtime 选项中的 engine/model 来自静态目录，无法实时反映后端变更。

本 change 采用“双语义并存 + 缓存服务”方案，最小化对既有执行链的扰动。

## Goals / Non-Goals

**Goals**

- 新增 `execution.skillrunner_mode`，仅用于 SkillRunner workflow 执行模式声明。
- SkillRunner workflow 缺失该字段时，在 loader/schema 阶段给出确定性失败。
- 执行链将该字段透传到 `/v1/jobs` 的 `runtime_options.execution_mode`。
- engine/model 枚举改为“后端缓存优先，静态目录兜底”。
- 提供启动首刷、每小时自动刷新、行级手动刷新入口。

**Non-Goals**

- 不改变 `execution.mode` 既有语义与兼容行为。
- 不改 `/v1/jobs*` 主执行链与 workflow 业务 hooks。
- 不把 execution 链迁移到 management API。

## Architecture

### 1) Workflow 合同与条件约束

- `src/schemas/workflow.schema.json`：
  - `executionSpec` 增加 `skillrunner_mode: "auto" | "interactive"`。
  - 增加条件规则：
    - 当 `provider=skillrunner` 或 `request.kind=skillrunner.job.v1` 时，要求 `execution.skillrunner_mode` 必填。
- `src/workflows/types.ts`：
  - `WorkflowExecutionSpec` 增加 `skillrunner_mode` 字段。

### 2) 执行链注入

- 在 `src/workflows/runtime.ts` 的 request 产出路径统一注入：
  - 仅当 manifest 属于 SkillRunner workflow 且声明了 `execution.skillrunner_mode` 时，
  - 将其写入 request 对象 `runtime_options.execution_mode`（不覆盖已有同值）。
- `src/providers/skillrunner/client.ts` 在 `toHttpStepsRequest` 中合并：
  - 已有 provider `no_cache` + request `runtime_options.execution_mode`。

### 3) 模型缓存服务

- 新增 `src/providers/skillrunner/modelCache.ts`：
  - Pref 持久化结构按 backend 维度记录 `backendId/baseUrl/updatedAt/engines/modelsByEngine`。
  - `refreshSkillRunnerModelCacheForBackend`：调用 `/v1/engines` 与 `/v1/engines/{engine}/models` 更新缓存。
  - `refreshAllSkillRunnerModelCaches`：遍历全部 SkillRunner backends 刷新。
  - 刷新失败保留旧缓存；首次无缓存失败返回空并交由静态目录兜底。
- `src/providers/skillrunner/modelCatalog.ts`：
  - 引擎与模型查询优先读取缓存快照。
  - 缓存不可用时回退静态快照（现有逻辑）。

### 4) Lifecycle 与 UI 触发入口

- `src/hooks.ts`：
  - `onStartup` 启动异步首刷并注册每小时定时刷新。
  - `onShutdown` 清理定时器。
- `src/modules/backendManager.ts`：
  - SkillRunner 行新增“刷新模型缓存”按钮，只刷新当前行 backend。
  - 保持原“进入管理页面/删除”行为不变。

## Risks / Trade-offs

- 条件 schema 约束会让未补齐字段的旧 SkillRunner workflow 在扫描阶段失败；通过同步更新内置 workflows 降低回归风险。
- 模型缓存引入定时任务；通过 shutdown 清理与失败保留旧缓存控制副作用。
- `getRuntimeOptionEnumValues` 需读取 backend 维度缓存，需扩展接口上下文以传递 backend 信息。
