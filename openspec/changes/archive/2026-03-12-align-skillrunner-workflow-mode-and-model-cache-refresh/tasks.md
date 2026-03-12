## 1. OpenSpec & Specs

- [x] 1.1 新建 `align-skillrunner-workflow-mode-and-model-cache-refresh` change 工件（proposal/design/tasks/.openspec.yaml）
- [x] 1.2 更新 `workflow-manifest-authoring-schema` delta：新增 `execution.skillrunner_mode` 与 SkillRunner 条件必填约束
- [x] 1.3 更新 `provider-adapter` delta：声明 `runtime_options.execution_mode` 注入与模型缓存来源策略
- [x] 1.4 更新 `backend-manager-ui` delta：SkillRunner 行新增“刷新模型缓存”动作

## 2. Workflow Contract & Injection

- [x] 2.1 扩展 `workflow.schema.json` 与 `WorkflowExecutionSpec`，新增 `execution.skillrunner_mode`
- [x] 2.2 增加条件校验：SkillRunner workflow 缺失 `execution.skillrunner_mode` 时 loader 校验失败
- [x] 2.3 在 request 构建链统一注入 `runtime_options.execution_mode`
- [x] 2.4 更新内置 SkillRunner workflows（`literature-digest`、`tag-regulator`）声明 `execution.skillrunner_mode="auto"`

## 3. SkillRunner Model Cache

- [x] 3.1 新增模型缓存服务（backend 维度持久化 + 读写/清理）
- [x] 3.2 实现后端拉取流程（`/v1/engines` + `/v1/engines/{engine}/models`）
- [x] 3.3 Model catalog 改为缓存优先、静态兜底
- [x] 3.4 baseUrl 变更不串缓存；刷新失败保留旧缓存；首次无缓存回退静态目录

## 4. Lifecycle & Backend Manager

- [x] 4.1 插件 startup 执行全 SkillRunner backend 首刷（异步）
- [x] 4.2 增加每小时自动刷新任务并在 shutdown 清理定时器
- [x] 4.3 Backend Manager 仅 SkillRunner 行显示“刷新模型缓存”按钮并执行行级刷新
- [x] 4.4 新增/更新中英文 locale 文案与错误提示

## 5. Tests & Verification

- [x] 5.1 补充 schema/loader 测试：SkillRunner 必填 `execution.skillrunner_mode`、非 SkillRunner 非必填、旧 `execution.mode` 不回退
- [x] 5.2 补充请求注入测试：declarative/buildRequest 均写入 `runtime_options.execution_mode`
- [x] 5.3 补充模型缓存测试：写缓存、失败保留旧缓存、首次失败静态兜底、baseUrl 不串缓存
- [x] 5.4 补充 Backend Manager UI 测试：按钮显示范围与行级刷新行为
- [x] 5.5 补充 lifecycle 测试：startup 首刷、每小时刷新、shutdown 清理
- [x] 5.6 运行 `npm run test:node:core`
- [x] 5.7 运行 `npm run test:node:ui`
- [x] 5.8 运行 `npm run test:node:workflow`
- [x] 5.9 运行 `npx tsc --noEmit`
