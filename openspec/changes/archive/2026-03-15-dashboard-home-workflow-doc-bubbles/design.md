## Context

该变更只收敛 Dashboard 首页与其右侧主区渲染，不改变 provider 协议与任务执行状态机。

首页 workflow 区与说明子页共享同一个 Dashboard 会话，左侧 tab 结构保持不变：

- 说明页仅替换右侧主区内容
- `selectedTabKey` 仍保持 `home`

## Goals / Non-Goals

**Goals**

- 首页显示已注册 workflow 的气泡入口
- 支持从首页直接查看 workflow README 说明
- 支持从首页直接跳转到 workflow 设置页
- 维持布局紧凑：气泡宽度由内容驱动，水平排列，放不下再换行

**Non-Goals**

- 不改 workflow 执行协议
- 不改 Dashboard 左侧 tab 信息架构
- 不引入外部文档站点跳转

## Decisions

### Decision 1: Host 快照扩展为首页 workflow 视图模型

在 `DashboardSnapshot` 中新增：

- `homeWorkflows[]`: 首页 workflow 气泡渲染数据
- `homeWorkflowDocView`: 当前说明子页数据（可空）

说明页数据包含 `workflowId/workflowLabel/readmeHtml/readmeMissing`，由 host 负责读取并安全渲染 markdown。

### Decision 2: 首页路由动作拆分

新增三类动作并保持语义单一：

- `open-home-workflow-doc`: 打开说明子页（仍位于 `home`）
- `close-home-workflow-doc`: 返回首页主视图
- `open-home-workflow-settings`: 跳转 `workflow-options` 并选中目标 workflow

### Decision 3: README 渲染策略

- 仅读取 `<workflowRoot>/README.md`
- 使用 markdown 渲染函数输出安全 HTML
- 缺失 README 时展示本地化提示，不抛出阻断异常

### Decision 4: 气泡布局不变量

首页 workflow 气泡采用紧凑布局，确保以下不变量：

- 单个气泡优先内容驱动宽度（fit-content / max-content）
- workflow 标题不换行
- 按钮行不换行且不重叠
- 容器水平排列并在空间不足时整体换行

## Risks / Trade-offs

- README 体量较大时，主区渲染开销增加
  - 通过仅在用户点击“说明”后按需读取降低开销
- 样式紧凑与多语言长度之间存在冲突
  - 通过气泡整体自适应宽度 + 容器换行平衡可读性
