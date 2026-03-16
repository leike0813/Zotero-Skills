## Why

当前一键部署区仍有旧输入项与文字状态展示，运行反馈分散，且托管本地后端在不同界面展示不一致。  
需要收敛 UI 行为与可观测反馈，降低状态漂移和误操作风险。

## What Changes

- 移除一键部署区的版本/tag 输入，版本由插件内默认值驱动。
- 一键部署区改为图标化状态展示：运行状态 LED、自动拉起 play 图标，不再显示租约状态文字。
- 在一键部署区并排加入“打开管理页面”“刷新模型缓存”按钮，仅运行中可用。
- 为 `up`、`down`、heartbeat fail 且收敛到 stopped 增加 toast，统一 backend 图标并添加 5 秒去重。
- 托管本地后端 ID 固定为 `local-skillrunner-backend`，用户可见展示统一走多语言显示名。
- backend manager 隐藏该托管后端，并在保存普通后端时保留托管后端配置。

## Capabilities

### New Capabilities

- `skillrunner-local-runtime-ui-adjustments`: 定义一键部署区 UI 收敛、toast 反馈、托管后端显示名与隔离规则。

### Modified Capabilities

- `backend-manager-ui`: 托管本地后端在后端管理器中的隐藏与保存保留规则。

## Impact

- 影响模块：本地运行时管理器、prefs 脚本、hooks 事件分发、task dashboard 展示标题、backend manager。
- 影响资源：`preferences.xhtml`、中英文 FTL 文案、`icon_backend.png` toast 图标映射。
- 影响测试：`test/core/73`、`test/ui/40`、`test/core/62`（显示名映射）。
