## Why

当前一键部署区的部署与卸载动作是“单击即执行”，缺少明确确认和过程可观测性。用户在无运行时信息、或执行高风险卸载时，无法在执行前确认影响范围，也无法在执行中判断进度。

## What Changes

- 为一键按钮新增“预判阶段”，仅在实际进入 deploy 分支时弹部署确认。
- 为卸载新增“两步确认”交互：先选项，再最终目录确认。
- 在设置页一键部署区新增内嵌 progressmeter，展示 deploy/uninstall 分步进度。
- 扩展 runtime manager 快照，新增 `details.actionProgress` 统一承载进度状态。
- 保持对外按钮事件名不变；新增内部编排事件 `planSkillRunnerLocalRuntimeOneclick`、`previewSkillRunnerLocalRuntimeUninstall`。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `skillrunner-local-runtime-state-machine-ssot`: 增加 one-click 预判分支、deploy 确认门禁、uninstall 双确认与进度可观测合同。
- `skillrunner-local-runtime-ui-adjustments`: 增加设置页内嵌 progressmeter、部署/卸载确认交互及文案合同。

## Impact

- 影响模块：
  - `src/modules/skillRunnerLocalRuntimeManager.ts`
  - `src/modules/skillRunnerReleaseInstaller.ts`
  - `src/hooks.ts`
  - `src/modules/preferenceScript.ts`
  - `addon/content/preferences.xhtml`
  - `addon/locale/en-US/preferences.ftl`
  - `addon/locale/zh-CN/preferences.ftl`
- 影响测试：
  - `test/core/73-skillrunner-local-runtime-manager.test.ts`
  - `test/ui/40-gui-preferences-menu-scan.test.ts`
- 影响文档：
  - `doc/components/skillrunner-local-runtime-oneclick-state-machine-ssot.md`
