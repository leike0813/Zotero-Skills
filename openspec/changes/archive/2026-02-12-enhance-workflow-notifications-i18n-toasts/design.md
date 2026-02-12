## Context

现有执行反馈主要集中在 `executeWorkflowFromCurrentSelection` 末尾的总结弹窗，且消息文本默认英文。  
用户需要两类增强：

1. 多语言执行提示；
2. 更细粒度反馈（触发开始 + 每个 job 结束的 Toast）。

同时，模板示例模块在启动期注册了示例快捷键与示例提示，会产生与业务无关的提醒噪音。

## Goals / Non-Goals

**Goals:**

- 为 Workflow 执行消息提供 en-US / zh-CN 本地化。
- 增加触发级与 job 级 Toast（自动消失）。
- 保留并兼容现有总结弹窗逻辑。
- 移除模板示例注册链路，清理示例提醒框。

**Non-Goals:**

- 不改动 provider 执行协议与 job 调度模型。
- 不引入新的持久化通知中心。
- 不改变 Task Manager 数据结构。

## Decisions

### Decision 1: 提示分层

- **触发级 Toast**：在一次触发构建出请求并开始执行前显示一次。
- **job 级 Toast**：每个 job 完成后显示一次，成功/失败分别提示。
- **总结弹窗**：保持现有“整次触发结束后”弹窗行为。

### Decision 2: 多语言策略

- 在 `addon.ftl` 中新增 workflow 执行提示键值（en-US / zh-CN）。
- `workflowExecuteMessage` 提供可注入 formatter 的消息拼装能力：
  - 默认 formatter 保持当前英文结构（便于单元测试稳定）；
  - 运行时由 `workflowExecute` 注入基于 `getString` 的本地化 formatter。

### Decision 3: Toast 实现方式

- 复用 `ztoolkit.ProgressWindow` 作为右下角自动消失提醒容器。
- 封装统一 `showWorkflowToast` helper，避免散落重复代码。

### Decision 4: 模板示例清理范围

- 从 `hooks.ts` 移除模板示例相关注册调用（快捷键、Prompt、示例 Item Pane/Column、示例提示）。
- 保留插件核心能力链路（Workflow 菜单、设置、任务管理等）。

## Risks / Trade-offs

- 去掉模板示例注册后，若存在隐式依赖可能导致测试回归；需通过全量测试验证。
- Toast 数量与并发 job 数成正比，可能在高并发触发下产生较多提示；本期通过自动消失降低干扰。

## Migration Plan

1. 先补测试（消息拼装 + 触发级/Job级提示触发次数）。
2. 实现本地化消息 formatter 与 Toast helper。
3. 接入 `executeWorkflowFromCurrentSelection` 主流程。
4. 移除模板示例注册调用。
5. 全量构建与测试回归。

## Open Questions

- （无）
