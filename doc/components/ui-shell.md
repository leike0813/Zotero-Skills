# UI Shell 组件说明

## 目标

提供插件可见入口：首选项按钮、右键菜单、任务管理窗口，并把用户动作分发到内核模块。

## 当前职责

- 启动时触发 workflow 扫描并初始化右键菜单
- 右键菜单按 workflow 展示可执行项，并显示不可用原因
- 提供以下入口：
  - 重新扫描 workflows
  - Workflow Settings
  - Backend Manager
  - Task Manager

## 右键菜单行为

- 根菜单固定为 `Zotero-Skills`（带图标）
- 每个 workflow 对应一个触发项
- 在 `popupshowing` 时动态判定可执行性：
  - 解析 workflow execution context
  - 尝试构建 request
  - 失败则菜单项禁用并附带原因

## 任务管理窗口（当前实现）

- 打开时会清理已完成任务（succeeded/failed/canceled）
- 实时显示任务列表三列：
  - Task Name
  - Workflow
  - Status（queued/running/completed）
- 当前不提供取消任务、日志查看、产物查看

## 边界

- UI Shell 不执行业务落库
- UI Shell 不包含 provider 协议逻辑
- 执行逻辑由 `workflowExecute` + `providers` + `applyResult` 完成

## 测试点（TDD）

- 菜单初始化与重建
- 菜单项禁用逻辑与禁用原因
- 右键菜单入口事件分发
- 任务窗口基础渲染与状态刷新
