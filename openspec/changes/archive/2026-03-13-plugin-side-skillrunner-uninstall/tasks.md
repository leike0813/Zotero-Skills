## 1. Runtime Manager Uninstall Refactor

- [x] 1.1 在 `skillRunnerLocalRuntimeManager` 中新增插件侧卸载执行器（停服、路径删除、结果汇总）。
- [x] 1.2 将 `uninstallLocalRuntime` 从 `runUninstallCommand` 切换到插件内执行器。
- [x] 1.3 实现 `down` 必须成功的硬前置：失败立即返回且不删文件。
- [x] 1.4 实现 `localRoot` 安全反推与校验失败即终止逻辑。

## 2. Managed Deletion Semantics

- [x] 2.1 实现镜像删除清单：`releases`、`agent-cache/npm`、`uv_cache`、`uv_venv`。
- [x] 2.2 实现 `clearData/clearAgentHome` 条件删除与默认保留策略。
- [x] 2.3 实现删除结果结构化输出：`removed_paths/failed_paths/preserved_paths/down_result`。
- [x] 2.4 实现“仅全链成功才清 profile/state”的状态收敛逻辑。

## 3. Bridge and Integration Cleanup

- [x] 3.1 降级 `SkillRunnerCtlBridge.runUninstallCommand` 为非主链路（或移除引用）。
- [x] 3.2 保持现有 prefs 事件与 UI 入口不变，验证触发链路兼容。

## 4. Tests and Validation

- [x] 4.1 更新 `73`：覆盖 down 失败中止、localRoot 校验失败、删除开关组合、删除失败保留状态。
- [x] 4.2 更新 `74`：移除/调整卸载脚本主链路断言，确保与新编排一致。
- [x] 4.3 运行 `npx tsc --noEmit`。
- [x] 4.4 运行 `npx tsx node_modules/mocha/bin/mocha "test/core/73-skillrunner-local-runtime-manager.test.ts" --require test/setup/zotero-mock.ts`。
- [x] 4.5 运行 `npx tsx node_modules/mocha/bin/mocha "test/core/74-skillrunner-ctl-bridge.test.ts" --require test/setup/zotero-mock.ts`。
