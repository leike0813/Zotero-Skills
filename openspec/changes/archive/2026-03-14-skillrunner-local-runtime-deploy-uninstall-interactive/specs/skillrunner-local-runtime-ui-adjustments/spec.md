## ADDED Requirements

### Requirement: Preferences One-Click Section SHALL Confirm Deploy Intent
设置页 one-click 交互在 deploy 分支 MUST 弹出确认提示并展示安装目录用途说明。

#### Scenario: Start branch does not show deploy confirmation
- **WHEN** one-click 预判结果为 `start`
- **THEN** 设置页 SHALL 直接执行 start 分支
- **AND** 设置页 SHALL NOT 弹部署确认

#### Scenario: Deploy branch shows confirmation with install layout
- **WHEN** one-click 预判结果为 `deploy`
- **THEN** 设置页 SHALL 弹部署确认
- **AND** 弹窗 SHALL 展示 `releases/data/agent-home/npm/uv_cache/uv_venv` 的目录用途说明

### Requirement: Preferences Uninstall SHALL Use Two-Step Confirmation
设置页卸载 MUST 先收集选项，再做最终确认。

#### Scenario: Options confirmation defaults to conservative cleanup
- **WHEN** 用户进入卸载确认流程
- **THEN** 默认选项 SHALL 为不清除 `data` 与 `agent-home`

#### Scenario: Final confirmation shows dynamic remove/preserve lists
- **WHEN** 用户完成卸载选项选择
- **THEN** 设置页 SHALL 基于预览结果展示“将删除/将保留”目录列表
- **AND** 用户取消任一步时 SHALL 终止卸载执行

### Requirement: Preferences SHALL Render Inline Progressmeter for Deploy and Uninstall
设置页一键部署区 MUST 在 deploy/uninstall in-flight 时显示 progressmeter，并随 `actionProgress` 更新。

#### Scenario: Progressmeter appears and updates during runtime action
- **WHEN** snapshot `details.actionProgress` 非空
- **THEN** 设置页 SHALL 显示 progressmeter 与步骤文本
- **AND** 进度值 SHALL 与 `current/total/percent/stage` 一致

#### Scenario: Progressmeter hides when action completes
- **WHEN** snapshot `details.actionProgress` 变为空
- **THEN** 设置页 SHALL 隐藏 progressmeter 区域
