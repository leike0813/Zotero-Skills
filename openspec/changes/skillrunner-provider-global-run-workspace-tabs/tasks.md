## 1. OpenSpec Artifacts

- [x] 1.1 完成 `proposal/design/specs/tasks` 并通过 `openspec validate --changes --strict`
- [x] 1.2 新增组件级 SSOT 文档（状态分组、单例路由、时序与不变量）

## 2. Host/Bridge Implementation

- [x] 2.1 将 `openSkillRunnerRunDialog` 收敛为单例 run workspace 路由（打开/聚焦/定位任务）
- [x] 2.2 扩展 host 快照为 `workspace + session` 合同并接入分组/分桶/排序逻辑
- [x] 2.3 支持左侧动作：`select-task`、`toggle-group-collapse`、`toggle-finished-collapse`
- [x] 2.4 保持 reply/cancel/auth-import 动作行为不变并绑定当前选中任务

## 3. Frontend Run Workspace UI

- [x] 3.1 改造 `run-dialog.html` 为左侧分组 + 右侧详情布局，右侧结构保持兼容
- [x] 3.2 改造 `run-dialog.css`：分组气泡样式、已结束任务紧凑 tab 样式
- [x] 3.3 改造 `run-dialog.js`：消费 `workspace + session` 快照并驱动左侧交互

## 4. Localization

- [x] 4.1 新增/更新 `zh-CN/en-US` 文案：`已结束任务`、`等待 requestId`、分组辅助文案

## 5. Tests & Verification

- [x] 5.1 新增/更新核心测试：单例路由、分组分桶、标题回退、无 requestId 禁用
- [x] 5.2 新增/更新前端对齐测试：左侧分组结构与终态紧凑样式
- [x] 5.3 运行 `npx tsc --noEmit`
- [x] 5.4 运行定向测试（run-dialog / dashboard snapshot 相关）
