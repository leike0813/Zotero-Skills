## Why

Dashboard 首页只有任务统计与运行表格，缺少 workflow 级入口，用户无法直接在首页查看每个 workflow 的说明或跳转到对应设置。

需要补齐两个能力：

- 首页 workflow 气泡区：快速查看与操作入口
- Dashboard 内嵌 workflow README 说明页：不离开当前页面即可阅读文档

## What Changes

- 在 Dashboard 首页统计区上方新增 workflow 气泡区（水平排列，按需换行）。
- 每个 workflow 气泡包含：
  - 标题：workflow label
  - 按钮：`说明`、`设置`
- 新增 Dashboard 右侧主区说明子页：
  - 读取并渲染 `<workflowRoot>/README.md`
  - 文件缺失时显示提示文本
  - 提供“回到 Dashboard”按钮返回首页主视图
- 新增 Dashboard host/web action：
  - `open-home-workflow-doc`
  - `close-home-workflow-doc`
  - `open-home-workflow-settings`
- 扩展 Dashboard snapshot：
  - `homeWorkflows`
  - `homeWorkflowDocView`

## Capabilities

### Updated Capabilities
- `task-runtime-ui`

## Impact

- 影响 `taskManagerDialog` 的首页快照构建、动作分发与 README 加载。
- 影响 `addon/content/dashboard` 前端渲染与样式。
- 增加首页 workflow 相关 i18n 文案。
- 增加对应回归测试以防止首页入口与说明页路由回退。
