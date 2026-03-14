## 1. OpenSpec Artifacts

- [x] 1.1 创建 change `skillrunner-oneclick-ui-adjustments` 并补齐 `proposal/design/specs/tasks`。
- [x] 1.2 新增 capability `skillrunner-local-runtime-ui-adjustments` 规格。
- [x] 1.3 更新 `backend-manager-ui` delta 规格，补充托管后端隐藏与保存保留语义。

## 2. Runtime & Toast

- [x] 2.1 本地运行时管理器接入 `runtime-up/runtime-down/runtime-abnormal-stop` toast 触发点。
- [x] 2.2 统一 toast 类型为 `skillrunner-backend`，并实现 5 秒同类事件去重。
- [x] 2.3 固定托管后端 ID 为 `local-skillrunner-backend`，并兼容旧状态 ID 迁移。

## 3. Preferences UI Convergence

- [x] 3.1 移除版本/tag 输入框，部署动作不再从 UI 传版本参数。
- [x] 3.2 一键部署区新增并排图标状态（运行 LED + 自动拉起 play）与两按钮（管理页/刷新模型缓存）。
- [x] 3.3 下线租约文字展示，保留状态栏消息用于动作反馈。
- [x] 3.4 增加 prefs 事件：`openSkillRunnerManagedBackendPage`、`refreshSkillRunnerManagedModelCache`。

## 4. Managed Backend Visibility & Display Name

- [x] 4.1 Backend Manager 隐藏 `local-skillrunner-backend` 行。
- [x] 4.2 Backend Manager 保存时保留隐藏的托管后端配置。
- [x] 4.3 新增 backend 显示名映射：`local-skillrunner-backend -> 本地后端/Local Backend`，并接入 dashboard/管理页标题。

## 5. Validation

- [x] 5.1 `npx tsc --noEmit`
- [x] 5.2 定向测试：`test/core/73-skillrunner-local-runtime-manager.test.ts`
- [x] 5.3 定向测试：`test/ui/40-gui-preferences-menu-scan.test.ts`
- [x] 5.4 回归测试：`test/core/62-task-dashboard-snapshot.test.ts`
- [x] 5.5 `npx openspec validate --changes --strict`
