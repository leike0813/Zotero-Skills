## Why

当前插件需要用户手工安装并运维 Skill-Runner 本地服务，门槛高且容易出现版本、端口、配置不一致。  
为降低接入成本并减少支持负担，需要在插件内提供本地模式的一键下载、部署、配置与托管保活能力。

## What Changes

- 在首选项新增 `SkillRunner Local Runtime` 独立区域，提供 `Deploy & Configure`、`Status`、`Start`、`Stop`、`Uninstall`、`Doctor` 操作。
- 部署入口统一为插件内执行链路，不再尝试拉起外部调试终端。
- 插件新增本地运行控制桥接：调用插件侧 release installer（下载/校验/解包）与 `skill-runnerctl`（仅 local mode）并统一结果归一化。
- 一键部署成功后自动写入托管 backend profile：`skillrunner-local`，默认请求端口 `29813`，允许 `29813~29823` 回退；profile `baseUrl` 以后端 `up/status` 实际返回端点为准。
- 新增托管状态持久化与按需保活：仅托管 profile 在执行前自动 ensure-up，并维护 lease `acquire/heartbeat/release`。
- 新增卸载能力：调用发布包内卸载脚本，默认不清理 data/agent-home；卸载成功后删除托管 profile 并清空托管状态。
- 冲突策略固定：若 `skillrunner-local` 已存在且非托管冲突，提示人工处理，不自动覆盖。
- 新增失败回退：复制“手动部署命令”用于系统终端复现排障。

## Capabilities

### New Capabilities

- `skillrunner-local-runtime-bootstrap`: 插件侧一键下载、部署、配置、托管与 lease 生命周期能力（local-only）。

### Modified Capabilities

- `provider-adapter`: 补充“仅托管本地 profile 触发 on-demand ensure-up + lease”语义。
- `backend-manager-ui`: 补充“自动写入 profile 的冲突提示且不覆盖”约束。

## Impact

- 主要变更文件：
  - `src/modules/preferenceScript.ts`
  - `src/hooks.ts`
  - `src/providers/skillrunner/provider.ts`
  - `src/utils/prefs.ts`
  - `addon/prefs.js`
  - `addon/content/preferences.xhtml`
  - `addon/locale/en-US/preferences.ftl`
  - `addon/locale/zh-CN/preferences.ftl`
  - 新增本地运行管理与脚本桥接模块（`src/modules/skillRunnerLocalRuntimeManager.ts`、`src/modules/skillRunnerCtlBridge.ts`）
- 主要测试：
  - core：桥接命令归一化、冲突策略、托管范围与 lease 语义
  - ui：preferences 新区域与事件绑定行为
