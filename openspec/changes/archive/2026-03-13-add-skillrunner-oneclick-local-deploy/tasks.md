## 1. OpenSpec Artifacts

- [x] 1.1 创建 `add-skillrunner-oneclick-local-deploy` change 并补齐 `proposal/design/tasks`
- [x] 1.2 新增 `skillrunner-local-runtime-bootstrap` spec delta
- [x] 1.3 更新 `provider-adapter` 与 `backend-manager-ui` delta spec

## 2. Runtime Bridge and Manager

- [x] 2.1 新增 `skillRunnerCtlBridge`：installer/ctl 命令调用与 JSON 归一化
- [x] 2.2 新增 `skillRunnerLocalRuntimeManager`：deploy/status/stop/doctor 编排
- [x] 2.3 增加托管状态持久化与类型（version/state json）
- [x] 2.4 实现 lease 生命周期：acquire/heartbeat/release（404 重获，409 停止）

## 3. UI and Hook Integration

- [x] 3.1 在 Preferences 增加 `SkillRunner Local Runtime` 独立区域与操作按钮
- [x] 3.2 绑定 Preferences 事件并接入 hooks 分发
- [x] 3.3 补齐中英文本地化文案与状态反馈
- [x] 3.4 实现冲突策略：`skillrunner-local` 冲突提示并中止，不自动覆盖

## 4. Execution Path Integration

- [x] 4.1 在 SkillRunner provider execute 前接入 `ensureManagedLocalRuntimeForBackend`
- [x] 4.2 仅托管 profile 启用 ensure-up/lease；非托管 profile 不受影响
- [x] 4.3 插件 shutdown 时执行 lease release（不自动 down）

## 5. Tests and Validation

- [x] 5.1 核心测试：桥接参数、结果归一化、deploy 成败链、冲突策略
- [x] 5.2 核心测试：托管范围与 lease 行为（acquire/heartbeat/release、404/409）
- [x] 5.3 UI 测试：Preferences 新区域渲染、按钮事件与 version 持久化
- [x] 5.4 回归：`npm run test:node:core`
- [x] 5.5 回归：`npm run test:node:ui`
- [x] 5.6 类型检查：`npx tsc --noEmit`
- [x] 5.7 规范校验：`openspec validate --changes --strict`

## 6. Direction Fix: Remove External Debug Terminal and Add Manual Fallback

- [x] 6.1 Preferences 部署入口改为纯插件执行，不再传递 debug-terminal 参数
- [x] 6.2 hooks 与 runtime manager 停用外部终端分支，统一走 deployAndConfigure
- [x] 6.3 新增“复制手动部署命令”动作与文案（中英）
- [x] 6.4 增强失败摘要（stage/exitCode/stderr preview）与日志细节
- [x] 6.5 回归：`npm run test:node:core`、`npm run test:node:ui`、`npx tsc --noEmit`、`openspec validate --changes --strict`

## 7. Direction Fix: Remove Plugin-Side Deploy Hotfix and Strict installDir Contract

- [x] 7.1 移除插件侧对 Skill-Runner 发布目录源码补丁的热修逻辑
- [x] 7.2 部署链路改为 installer `installDir` 严格必需，移除 `installRoot/version` 回退
- [x] 7.3 更新 core 测试：`ctl install` 失败不重试热修、缺少 `installDir` 直接失败
- [x] 7.4 同步更新 `skillrunner-local-runtime-bootstrap` spec 与设计文档

## 8. Contract Alignment: Bootstrap Report + Lease Payload SSOT

- [x] 8.1 部署链路改为 `install -> bootstrap report -> ctl up -> ctl status`（移除显式 `ctl install`）
- [x] 8.2 消费 `<installDir>/data/agent_bootstrap_report.json`：`partial_failure` 告警继续、缺失/坏 JSON 失败
- [x] 8.3 lease 请求体对齐：acquire 发送 `owner_id/metadata`，heartbeat/release 发送 `lease_id`
- [x] 8.4 心跳周期改为优先使用 `heartbeat_interval_seconds`（默认 20s）
- [x] 8.5 手动命令改为 `install/bootstrap/up/status/doctor` 并补齐回归测试
- [x] 8.6 installer 改为 JSON 调用（`-Json/--json`），并优先解析 `install_dir`

## 9. Direction Fix: Plugin-Native Release Installer (No `reference` Runtime Dependency)

- [x] 9.1 新增插件侧 release 安装模块：下载产物、SHA256 校验、系统 `tar` 解包
- [x] 9.2 `skillRunnerLocalRuntimeManager` 部署链切换为 `release install -> ctl bootstrap -> bootstrap report -> up -> status`
- [x] 9.3 `skillRunnerCtlBridge` 移除 installer/reference 依赖，新增系统命令执行接口
- [x] 9.4 手动命令改为“直接下载 release 并解包”的无 reference 版本
- [x] 9.5 新增/调整核心测试（73/74/75）覆盖安装链与桥接行为

## 10. Contract Alignment: Dynamic Runtime Endpoint + Uninstall

- [x] 10.1 默认端口策略切换为 `requested_port=29813` + `port-fallback-span=10`
- [x] 10.2 部署/保活以 `ctl up/status` 返回的实际端点为 SSOT，并回写 state/profile
- [x] 10.3 历史配置不做一次性迁移，仅新部署生效
- [x] 10.4 新增 `Uninstall` 按钮与 hooks 事件链路
- [x] 10.5 接入卸载脚本调用；卸载成功后删除托管 profile 并清空 state
- [x] 10.6 同步测试（73/74/40）覆盖端口回退透传、动态端点、卸载行为
