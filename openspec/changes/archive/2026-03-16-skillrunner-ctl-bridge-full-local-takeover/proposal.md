# Change: skillrunner-ctl-bridge-full-local-takeover

## Why

`skill_runnerctl` 在 Zotero 常规运行环境下存在返回不稳定与输出不可观测问题，导致：

- bootstrap 可能执行完成但返回体缺失，插件误判失败；
- 后续 `preflight/up/down/status/doctor` 依赖 ctl JSON 回包，链路脆弱；
- 用户可见“手动命令”与插件实际行为逐步偏离。

需要将本地控制面收敛为插件桥接器单点实现，避免运行期再依赖 ctl 脚本返回。

## What Changes

1. `SkillRunnerCtlBridge` 新增本地原生动作：
   - `bootstrapLocalRuntime`
   - `preflightLocalRuntime`
   - `upLocalRuntime`
   - `downLocalRuntime`
   - `statusLocalRuntime`
   - `doctorLocalRuntime`
2. `skillRunnerLocalRuntimeManager` 主流程改接桥接原生动作，不再把 ctl 作为运行期真源。
3. 手动部署命令文案改为桥接等价流程，不再暴露 `skill-runnerctl ...`。
4. 失败诊断统一输出桥接动作上下文（路径、端口、日志、state 文件等）。
5. 同步更新本地运行时 SSOT，移除 ctl 依赖叙述。

## Impact

- 外部 prefs 事件与 UI 按钮入口不变。
- 内部行为变化：本地控制链路以插件桥接实现为唯一真源。
- `runCtlCommand` 可保留供测试桩/兼容路径使用，但不再是 manager 主流程依赖。
