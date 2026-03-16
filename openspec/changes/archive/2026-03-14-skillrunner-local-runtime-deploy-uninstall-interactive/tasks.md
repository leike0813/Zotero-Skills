## 1. OpenSpec Artifacts

- [x] 1.1 完成 `proposal/design/specs/tasks` 工件
- [x] 1.2 同步组件 SSOT 文档中的 deploy/uninstall 交互时序

## 2. Runtime Manager and Installer

- [x] 2.1 新增 one-click 预判接口 `planLocalRuntimeOneclick`（含 `installLayout`）
- [x] 2.2 新增卸载预览接口 `previewLocalRuntimeUninstall`
- [x] 2.3 为 `deployAndConfigureLocalSkillRunner` 增加 `forcedBranch` 执行门控
- [x] 2.4 新增并维护 `details.actionProgress`（deploy/uninstall）
- [x] 2.5 扩展 `installSkillRunnerRelease` 支持 `onProgress` 回调

## 3. Prefs Events and UI

- [x] 3.1 hooks 新增内部事件 `planSkillRunnerLocalRuntimeOneclick`、`previewSkillRunnerLocalRuntimeUninstall`
- [x] 3.2 设置页 deploy 走“预判 ->（deploy分支确认）-> 执行”
- [x] 3.3 设置页 uninstall 走“两步确认 -> 执行”
- [x] 3.4 设置页新增内嵌 progressmeter + step text，并绑定 `actionProgress`
- [x] 3.5 补齐中英文确认文案与进度文案

## 4. Tests and Validation

- [x] 4.1 更新 `test/core/73`：预判/预览、deploy 5步进度、uninstall 进度断言
- [x] 4.2 更新 `test/ui/40`：deploy 仅 deploy 分支确认、卸载双确认、progressmeter 显示
- [x] 4.3 运行 `npx tsc --noEmit`
- [x] 4.4 运行定向测试：`test/core/73-skillrunner-local-runtime-manager.test.ts`
- [x] 4.5 运行定向测试：`test/ui/40-gui-preferences-menu-scan.test.ts`
- [x] 4.6 运行 `npx openspec validate \"skillrunner-local-runtime-deploy-uninstall-interactive\" --type change --strict --no-interactive`
