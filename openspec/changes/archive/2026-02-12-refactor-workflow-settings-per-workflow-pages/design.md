## Context

当前 `openWorkflowSettingsDialog` 基于“单对话框 + workflow 选择控件”渲染同一套表单。用户在多 workflow 间切换时，需要反复切换下拉并重新辨识上下文；同时 Run Once 的展示值来自“上次一次性覆盖输入”与 Persistent 的混合状态，容易造成“当前看到的默认值不是当前持久配置”的困惑。

本次变更将设置交互改为“先选 workflow，再进入该 workflow 专属页面”，并将 Run Once 默认值固定为“每次打开时复制 Persistent 快照”，不新增额外选项。

## Goals / Non-Goals

**Goals:**

- 每个 workflow 拥有独立设置页面（单页面仅服务一个 workflow）。
- 右键菜单与首选项按钮都提供一致的 workflow 二级选择入口。
- 移除旧设置页中的 workflow 下拉控件。
- 每次打开设置页时，Run Once 表单默认值与当前 Persistent 设置一致。
- 保持现有保存语义：`Save Persistent` 持久化；`Run Once` 仅影响下一次执行。

**Non-Goals:**

- 不改变 workflow 参数 schema、provider options schema 的定义方式。
- 不改变 workflow 实际执行时 `consumeRunOnce` 的消费机制。
- 不引入新的设置存储键或迁移格式。

## Decisions

### Decision 1: 设置页采用“单 workflow 上下文”渲染

- `openWorkflowSettingsDialog` 新增可选参数 `workflowId`。
- 打开对话框时必须确定一个目标 workflow；对话框内不再展示 workflow 选择控件。
- 页面标题可包含 workflow label，明确当前上下文。

原因：

- 避免统一大页面中的上下文切换成本。
- 降低误改其他 workflow 配置的风险。

### Decision 2: Workflow 入口统一为“二级列表 -> 目标页面”

- 右键菜单：`Workflow Settings` 改为子菜单，列出当前已加载 workflows，每个子项直达对应设置页。
- 首选项按钮：点击后弹出同样的 workflow 列表（与右键入口一致），再打开对应设置页。

原因：

- 两个入口语义一致，减少心智负担。
- 满足用户决策 C（先弹出二级列表再选 workflow）。

### Decision 3: Run Once 每次打开都由 Persistent 初始化

- 对话框初始化时，Run Once 字段值从当前 workflow 的 Persistent 设置拷贝，而不是读取上次 Run Once 覆盖值。
- 为避免“界面显示与实际执行值不一致”，打开设置页时清理该 workflow 的待消费 Run Once override（若存在）。

原因：

- 保证“每次打开看到的 Run Once 默认值 = 当前持久值”这一语义严格成立。

### Decision 4: 不新增“Run Once 跟随 Persistent”开关

- 该行为作为默认且固定行为，不暴露额外布尔配置。

原因：

- 用户已明确不需要新增开关。
- 避免配置项增长与行为分叉。

## Risks / Trade-offs

- [清理待消费 Run Once 可能改变少数用户预期] -> 在文档与提示文案中明确：重新打开设置页会重置一次性覆盖默认值。
- [菜单结构变化影响现有测试与定位习惯] -> 增补 GUI 测试，确保入口可发现且稳定。
- [首选项页实现“二级列表”需要额外 UI 适配] -> 复用现有 choice/popup 控件样式与事件模式，减少新组件引入。

## Migration Plan

1. 先补测试：菜单结构、首选项按钮交互、单 workflow 页面渲染、Run Once 初始化。
2. 重构菜单与首选项入口，改为 workflow 列表选择流程。
3. 改造 `openWorkflowSettingsDialog` 为单 workflow 模式，移除 workflow 下拉。
4. 接入 Run Once 初始化与清理逻辑，确保显示值与执行值一致。
5. 更新文档与本地化文案，执行构建与测试回归。

## Open Questions

- 首选项页二级列表是使用原生 popup 还是沿用 dialog 内 `choice-control` 样式组件；实现阶段可按最小改动优先选型。
