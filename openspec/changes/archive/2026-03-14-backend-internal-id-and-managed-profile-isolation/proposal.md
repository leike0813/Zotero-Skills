# Proposal: Backend Internal ID Migration And Managed Profile Isolation

## Why
当前 backend 配置将 `id` 同时作为内部标识与展示名称，导致改名后 dashboard 残留、托管本地后端隔离不彻底、以及后续状态收敛困难。

## What Changes
- 旧 backend 一次性迁移：`displayName = old.id`，`id` 改为新规则生成的内部唯一 ID。
- 旧托管本地后端 `skillrunner-local` 一次性迁移为 `local-skillrunner-backend`。
- 同步迁移 `workflowSettingsJson` 与 `taskDashboardHistoryJson` 中的 backendId 引用。
- backend manager 仅编辑 `displayName`，内部 `id` 不可编辑。
- backend manager 隐藏托管本地后端（兼容旧/新托管 ID）。

## Non-Goals
- 本次不清理一次性迁移代码路径（待实机迁移完成后单独收口）。

