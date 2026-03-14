## Why

当前一键部署自动拉起开关是“会话内状态”，插件启动时会重置并由启动 preflight 改写，导致重启后行为与用户上次设置不一致。  
需要把自动拉起改为持久化语义，并明确启动阶段的门控规则，消除状态漂移。

## What Changes

- 自动拉起开关恢复为持久化字段：`skillRunnerLocalRuntimeStateJson.autoStartPaused`。
- 插件启动时先从持久化值 hydrate 会话开关，缺失值按“关闭”处理。
- `startup preflight` 仅在持久化开关为开启时执行。
- preflight 成功/失败与手动 stop 对自动拉起的改写都同步写回持久化。
- 调整测试与 SSOT，删除“session-only”假设。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `skillrunner-local-runtime-state-machine-ssot`: 启动自动拉起来源改为持久化，启动 preflight 改为开关门控，并把自动拉起改写定义为持久化副作用。

## Impact

- 影响模块：
  - `src/modules/skillRunnerLocalRuntimeManager.ts`
  - `src/hooks.ts`
- 影响测试：
  - `test/core/73-skillrunner-local-runtime-manager.test.ts`
  - `test/ui/40-gui-preferences-menu-scan.test.ts`（仅必要断言）
- 文档更新：
  - `doc/components/skillrunner-local-runtime-oneclick-state-machine-ssot.md`
  - 新增 change delta spec
