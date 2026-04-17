## 1. OpenSpec Artifacts

- [x] 1.1 补齐本次 SkillRunner 右侧壳层迁移的 proposal、design、delta specs 与 tasks
- [x] 1.2 用 capability 级 OpenSpec 术语记录 sidebar host、入口路由、窄栏导航与 fallback 契约

## 2. Sidebar Host Integration

- [x] 2.1 在 library item pane 与 reader context pane 中挂载 SkillRunner 右侧壳层宿主
- [x] 2.2 收敛 `open`、`toggle`、`close` 三类入口语义，并复用 native pane 恢复逻辑
- [x] 2.3 保留旧 run dialog 作为侧栏宿主初始化失败时的 fallback

## 3. Workspace Navigation Refactor

- [x] 3.1 将旧 run workspace 左侧任务区改造为 sidebar `Running/Completed` 任务抽屉
- [x] 3.2 在主区顶部增加当前主父条目相关的运行中任务快捷区
- [x] 3.3 将父条目相关性、关联样式与自动聚焦限制为非终态任务

## 4. UI Entry Points and Localization

- [x] 4.1 更新主工具栏、右侧 toolstrip、页面顶部全局工具栏与相关 tooltip 为 Skill-Runner 侧栏语义
- [x] 4.2 补齐窄栏页面新增按钮、标题与提示语的多语言文案

## 5. Verification

- [x] 5.1 新增并更新 sidebar host runtime、toolbar entrypoint、run-dialog UI alignment 等定向测试
- [x] 5.2 运行 `npx tsc --noEmit` 与相关定向测试验证侧栏迁移实现
- [x] 5.3 运行 `openspec validate --changes --strict` 验证本次 change artifacts
