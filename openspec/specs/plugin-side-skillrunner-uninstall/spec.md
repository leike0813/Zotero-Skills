# plugin-side-skillrunner-uninstall Specification

## Purpose
TBD - created by archiving change plugin-side-skillrunner-uninstall. Update Purpose after archive.
## Requirements
### Requirement: Plugin SHALL Execute Uninstall Flow Internally
插件 MUST 在内部执行 SkillRunner 本地运行时卸载编排，不得把卸载主流程委托给发布包卸载脚本。

#### Scenario: Uninstall uses plugin-side orchestration
- **WHEN** 用户触发 `uninstallSkillRunnerLocalRuntime`
- **THEN** 插件 SHALL 执行插件内卸载链路（停服、删除、状态收敛）
- **AND** 插件 MUST NOT 以 `skill-runner-uninstall.ps1/.sh` 作为主执行路径

### Requirement: Uninstall SHALL Require Successful Down Before Deletion
插件在执行任何文件删除前，MUST 先通过 `ctl down --mode local` 成功停服。

#### Scenario: Down fails and uninstall aborts
- **WHEN** `ctl down` 返回非成功
- **THEN** 卸载 SHALL 立即失败
- **AND** 插件 MUST NOT 执行文件删除
- **AND** 托管 profile 与 runtime state MUST 保留用于排障

### Requirement: Plugin SHALL Enforce Safe localRoot Resolution
插件 MUST 仅在可从托管 `installDir` 安全反推并校验通过 `localRoot` 时执行删除。

#### Scenario: localRoot cannot be resolved safely
- **WHEN** `installDir` 缺失、非绝对路径、或 `releases` 层级校验失败
- **THEN** 卸载 SHALL 失败并返回路径校验错误
- **AND** 插件 MUST NOT 删除任何路径

### Requirement: Plugin SHALL Mirror Managed Deletion Scope With Retention Flags
插件 MUST 按既定目录清单删除运行时文件，并按开关保留或删除 `data` 与 `agent-home`。

#### Scenario: Default uninstall keeps data and agent-home
- **WHEN** 用户未勾选 `clearData` 且未勾选 `clearAgentHome`
- **THEN** 插件 SHALL 删除 `releases`、`agent-cache/npm`、`agent-cache/uv_cache`、`agent-cache/uv_venv`
- **AND** 插件 SHALL 保留 `data` 与 `agent-cache/agent-home`

#### Scenario: Uninstall with clear flags removes optional directories
- **WHEN** 用户勾选 `clearData` 或 `clearAgentHome`
- **THEN** 插件 SHALL 删除对应目录
- **AND** 当 `clearData` 与 `clearAgentHome` 同时为 true 时，插件 MAY 尝试删除 `localRoot`

### Requirement: Uninstall SHALL Clear Managed State Only After Full Success
插件 MUST 仅在停服成功且删除步骤无失败时清理托管配置状态。

#### Scenario: Full success clears profile and runtime state
- **WHEN** 停服成功且目标路径删除全部成功
- **THEN** 插件 SHALL 删除托管 profile `local-skillrunner-backend`
- **AND** 插件 SHALL 清空托管 runtime state

#### Scenario: Any deletion failure keeps managed state
- **WHEN** 任一路径删除失败
- **THEN** 卸载 SHALL 失败
- **AND** 插件 MUST 保留托管 profile 与 runtime state
- **AND** 返回结果 SHALL 包含 `removed_paths`、`failed_paths`、`preserved_paths`
