## 1. Artifact Extension (Doc + Implementation)

- [x] 1.1 更新 `design/specs/tasks`，将 change 从“仅文档”扩展为“文档 + 代码实现 + 回归测试”。
- [x] 1.2 在 `doc/components/skillrunner-local-runtime-oneclick-state-machine-ssot.md` 增补实现映射说明（状态/事件 -> 代码入口）。
- [x] 1.3 保持 SSOT 术语一致：`lease acquire`，不使用 `require`。

## 2. Runtime State Machine Implementation

- [x] 2.1 在本地运行时管理器实现 one-click 主入口：有 runtime info 时先 preflight，成功走 `up -> lease acquire`，失败回退 deploy；无 runtime info 直接 deploy。
- [x] 2.2 实现 stop 收敛链路：`lease release -> down -> status probe`，按 `running/stopped/error` 收敛而非直接强制 stopped。
- [x] 2.3 实现自动拉起切换规则：preflight 成功开启、失败关闭、无 runtime info 保持关闭。
- [x] 2.4 实现启动时 preflight 策略：插件启动默认 auto-start 关闭；有 runtime info 执行一次 preflight 并驱动开关。
- [x] 2.5 实现监测收敛：heartbeat fail 后先 status 探测；`status=running` 进入单实例轮询；heartbeat success 打断轮询，heartbeat fail 继续轮询并告警。
- [x] 2.6 状态快照补齐 SSOT UI 门禁字段：`hasRuntimeInfo`、`inFlightAction`、`monitoringState`。

## 3. UI and Hooks Convergence

- [x] 3.1 偏好页按钮收敛为四个可见动作：`一键部署/启动`、`停止`、`卸载`、`打开调试控制台`。
- [x] 3.2 移除旧按钮与绑定：`状态`、`启动`、`诊断`、`复制手动部署命令`、`自动拉起切换`。
- [x] 3.3 实现按钮门禁矩阵：全局动作互斥；running 仅 stop 可用；无 runtime info 卸载禁用。
- [x] 3.4 保留例外：`打开调试控制台`始终可用（不受 running / in-flight 限制）。
- [x] 3.5 hooks 删除旧 prefs 事件入口：`status/start/doctor/copy-commands/toggle-auto-pull`；`deploySkillRunnerLocalRuntime` 语义收敛为 one-click。

## 4. Localization and Contract Alignment

- [x] 4.1 更新中英文 FTL 一键按钮文案为动作语义（One-click Deploy/Start / 一键部署/启动）。
- [x] 4.2 清理偏好页已下线按钮对应的文案键值。

## 5. Test and Validation

- [x] 5.1 更新 `test/core/73`：覆盖 one-click 两路径、stop 收敛、startup preflight、快照字段扩展。
- [x] 5.2 更新 `test/ui/40`：覆盖四按钮收敛、旧事件不再发出、debug 按钮例外可用。
- [x] 5.3 运行 `npx tsc --noEmit`。
- [x] 5.4 定向运行 `test/core/73`、`test/core/74`、`test/ui/40` 并通过。

## 6. Incremental Extension (Post-Review Fixes)

- [x] 6.1 调整 one-click deploy 分支返回语义：deploy 成功后必须等待 post-deploy preflight，再决定成功/失败返回。
- [x] 6.2 补充 stop 行为收敛：手动 stop 入口即时关闭 auto-start，不依赖 stop 结果成功与否。
- [x] 6.3 增加本地运行时状态变更通知机制，确保后台 auto-start 与手动动作都触发设置页同源刷新。
- [x] 6.4 更新 `test/core/73` 与 `test/ui/40` 覆盖上述增量规则。

## 7. Incremental Extension (Convergence Patch Round 2)

- [x] 7.1 将后台 auto ensure 启动链（`up` 未返回）纳入统一 in-flight 门禁，禁用 one-click/stop/uninstall。
- [x] 7.2 调整卸载语义为“入口即清空 runtime info，失败不回滚 runtime info”。
- [x] 7.3 调整 debug console 动作为静默模式：不写状态栏 working/success/fail 文本。
- [x] 7.4 更新 `test/core/73` 与 `test/ui/40` 覆盖上述三项收敛规则。
