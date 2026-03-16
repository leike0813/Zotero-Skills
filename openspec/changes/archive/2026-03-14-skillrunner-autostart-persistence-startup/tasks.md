## 1. OpenSpec Artifacts

- [x] 1.1 完成 `proposal/design/specs/tasks` 工件

## 2. Runtime Manager Persistence

- [x] 2.1 恢复 `autoStartPaused` 持久化写入（移除写入时删除逻辑）
- [x] 2.2 新增“从持久化 hydrate 会话开关”入口
- [x] 2.3 新增统一“会话+持久化同步写”入口，并替换 toggle/preflight/stop 的分散改写
- [x] 2.4 缺失 `autoStartPaused` 时默认按关闭解释

## 3. Startup Gate

- [x] 3.1 `onStartup` 改为 hydrate 后按开关门控 startup preflight
- [x] 3.2 `runManagedRuntimeStartupPreflightProbe` 增加 `startup-preflight-skip-paused` 分支
- [x] 3.3 启动阶段 no-runtime-info / missing-ctl 分支保持可观测并与开关持久化规则一致

## 4. Tests and Validation

- [x] 4.1 更新 `test/core/73`：session-only 断言改为 hydrate/persist 断言
- [x] 4.2 新增 `startup-preflight-skip-paused` 与“开关开启才执行 startup preflight”断言
- [x] 4.3 如需，更新 `test/ui/40` 中与重启后开关显示相关断言
- [x] 4.4 运行 `npx tsc --noEmit`
- [x] 4.5 运行定向测试：`test/core/73-skillrunner-local-runtime-manager.test.ts`、`test/ui/40-gui-preferences-menu-scan.test.ts`
- [x] 4.6 运行 `npx openspec validate --change \"skillrunner-autostart-persistence-startup\" --strict`
