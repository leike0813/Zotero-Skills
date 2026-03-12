## Why

SkillRunner 后端能力已升级到同时支持 `auto|interactive` 执行模式与实时模型目录查询。当前插件仍将执行模式耦合到旧字段，并依赖静态模型快照，导致 workflow 合同与后端能力不一致，模型选项易过期。

## What Changes

- 保留既有 `execution.mode` 语义不变，新增 SkillRunner 专用字段 `execution.skillrunner_mode`（`auto|interactive`）。
- 对 SkillRunner workflow 增加条件约束：必须声明 `execution.skillrunner_mode`；generic-http / pass-through 不要求该字段。
- 请求构建链在不改变 `/v1/jobs -> upload -> poll -> result|bundle` 流程的前提下，将 `execution.skillrunner_mode` 注入 `runtime_options.execution_mode`。
- 新增 SkillRunner 模型缓存服务：按 backend 维度从后端拉取 engines/models 并持久化，运行时“缓存优先，静态兜底”。
- 增加刷新机制：插件启动首刷、每小时自动刷新、Backend Manager 行级手动刷新（仅 SkillRunner 行）。
- 失败回退策略：刷新失败时保留旧缓存；首次无缓存失败时回退静态内置目录。

## Capabilities

### Modified Capabilities

- `workflow-manifest-authoring-schema`
- `provider-adapter`
- `backend-manager-ui`

## Impact

- Workflow manifest schema/types 与 loader 校验逻辑。
- Workflow request 构建与 SkillRunner client runtime options 注入逻辑。
- SkillRunner provider 模型枚举来源（静态 -> 缓存优先）。
- Backend Manager SkillRunner 行操作区与本地化文案。
- 插件 lifecycle（startup/shutdown）增加模型缓存刷新调度。
