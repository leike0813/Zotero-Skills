# UI Shell 组件说明

## 目标

提供可扩展的 UI 骨架：右键菜单按 Workflow 分组、设置页面用于注册工作流目录，未来支持每个 Workflow 的个性化配置入口。

## 职责

- 注册 Workflow 目录并加载可用工作流
- 生成右键菜单（按 Workflow 分组）
- 提供基础设置入口与状态展示
- 为未来“工作流配置 UI”预留扩展点
- 提供独立任务管理窗口入口

## 输入

- Workflow 注册目录（由插件总体设置指定）
- 已解析的 Workflow 列表
- Selection/Context 当前选择状态

## 输出

- 右键菜单项集合
- 设置页内容（工作流目录设置与状态提示）
- 独立任务管理窗口（任务状态、日志、产物、错误）

## 工作流注册策略

1. 在插件设置中指定 “Workflow 目录”
2. 启动时扫描目录，读取 Workflow 包（`workflow.json` + hooks）
3. 注册到内部 Workflow Registry

## 右键菜单组织

- 按 Workflow 分组
- 每个 Workflow 菜单项触发一次 Job 创建
- 若当前选择与 Workflow 输入不匹配，则禁用或隐藏

## 行为与边界

- Workflow 结构未定时，先只展示基础信息（id/label）
- 不在 UI Shell 层执行任务，仅派发事件
- UI Shell 不做输入校验，校验由 Job 队列执行

## 失败模式

- 目录无效或不可读：显示警告提示
- Workflow 解析失败：跳过并记录错误

## 测试点（TDD）

- Workflow 目录配置持久化
- 扫描目录成功生成菜单
- 不匹配的选择禁用菜单项
