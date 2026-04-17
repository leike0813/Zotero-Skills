## Why

当前 SkillRunner 运行前端仍以独立 run workspace 窗口承载，用户需要在 Dashboard、独立运行窗口、Zotero 右侧原生 pane 之间频繁切换。  
对于已经存在 Dashboard 和 reader/library 右侧 pane 的 Zotero 插件来说，这种“额外再开一个窗口”的模型增加了明显的心智负担，也让当前条目上下文与运行交互割裂。

## What Changes

- 将 SkillRunner 运行前端从独立单例窗口迁移到 Zotero 右侧壳层，覆盖 library 和 reader 两套宿主。
- SkillRunner 在右侧壳层中作为独立 mode/page 承载，不再作为 item preview section，也不再以独立 run window 作为主路径。
- “打开运行详情”相关入口收敛为右侧 SkillRunner 壳层路由；旧 run dialog 仅保留为宿主注入失败时的 fallback。
- 原 run workspace 左侧任务区改为适配窄栏的 `Sessions/任务` 抽屉与顶部快捷区，右侧主交互区保留现有聊天、pending/auth、reply/cancel 能力。
- 新增与当前条目父项关联的运行聚焦、关联展示、顶部快捷切换、toolbar/toolstrip 开关与关闭恢复能力。
- 更新多语言文案、右侧 toolstrip 按钮、顶部工具栏按钮与 sidebar host bridge 契约，统一为 Skill-Runner 侧栏语义。

## Capabilities

### New Capabilities
- `skillrunner-sidebar-shell-host`: 定义 SkillRunner 右侧壳层宿主、library/reader 集成、打开/关闭与 fallback 契约。

### Modified Capabilities
- `skillrunner-provider-global-run-workspace-tabs`: 将全局 run workspace 从独立单例窗口迁移为右侧壳层主宿主，并调整任务导航结构。
- `task-dashboard-skillrunner-observe`: 调整 SkillRunner 观察/交互前端在 sidebar 窄栏中的展示、关联与会话切换要求。

## Impact

- 影响模块：`skillRunnerSidebar`、`skillRunnerRunDialog`、`dashboardToolbarButton`、`hooks`、Dashboard/Run workspace 前端资源。
- 影响资源：`addon/content/dashboard/run-dialog.{html,css,js}`、`addon/content/zoteroPane.css`、`addon/locale/**/addon.ftl`。
- 影响入口：Dashboard `open-run`、workflow `request-created`、主工具栏 Skill-Runner 按钮、右侧 toolstrip Skill-Runner 按钮。
- 影响测试：sidebar host runtime、run-dialog 前端对齐、toolbar entrypoint、SkillRunner 路由与任务抽屉/快捷区行为测试。
