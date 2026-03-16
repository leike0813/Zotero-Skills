## 1. OpenSpec Artifacts

- [x] 1.1 完成 `proposal/design/specs/tasks` 工件
- [x] 1.2 新增组件级 SSOT 文档（提交前设置时序、Dashboard Workflow选项状态模型、不变量）

## 2. Settings Model Refactor

- [x] 2.1 执行链移除 run-once 消费语义，改为 `persisted + executionOptionsOverride`
- [x] 2.2 新增“可配置 workflow 判定”并用于交互门禁（profile/params/provider options 任一可编辑）
- [x] 2.3 保持 run-once 旧 API 兼容壳但不参与执行语义

## 3. Interactive Submit Gate and Web Dialog

- [x] 3.1 交互入口（右键 workflow 触发）强制提交前设置门禁
- [x] 3.2 新增独立网页提交前设置弹窗（Dashboard 风格）
- [x] 3.3 `confirm` 返回 `{ executionOptions, persist }` 并按 `persist` 决定是否写入持久配置
- [x] 3.4 无可用 profile 时阻止提交并给出可观测阻塞状态

## 4. Dashboard Workflow Options Tab

- [x] 4.1 新增 Dashboard 顶层 `Workflow选项` tab
- [x] 4.2 新增 workflow 子 tab（仅展示可配置 workflow）
- [x] 4.3 字段编辑防抖持久化并回传保存状态 `saving/saved/error`
- [x] 4.4 首选项 `openWorkflowSettings` 路由到 Dashboard `workflow-options` tab

## 5. Localization and Regression

- [x] 5.1 补齐 `en-US/zh-CN` 新增 key（workflow-options、submit dialog、save state）
- [x] 5.2 更新 workflow settings 执行测试到单一持久 + submit override 语义
- [x] 5.3 运行 `npx tsc --noEmit`
- [x] 5.4 运行定向测试并确认通过（`test/ui/35` 及 dashboard/workflow 相关）
- [x] 5.5 运行 `openspec validate --changes --strict`

## 6. Round-2 Stability and Contract Alignment

- [x] 6.1 `workflow-options` tab 停止周期/task-update 刷新重建，修复输入失焦与下拉交互问题
- [x] 6.2 数值控件去除 spinbox 依赖，增加字段级数值校验（非法不落盘）
- [x] 6.3 SkillRunner runtime options 按 `skillrunner_mode` 做 UI 与请求映射门禁（interactive/auto）
- [x] 6.4 提交弹窗移除框架冗余取消按钮并收敛为紧凑尺寸布局
- [x] 6.5 文案语义统一为“默认配置 / default settings”，清理 persistent 残留
- [x] 6.6 运行 `npx tsc --noEmit` 与定向测试，完成 OpenSpec 严格校验
