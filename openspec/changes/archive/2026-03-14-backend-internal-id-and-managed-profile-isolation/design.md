# Design: Backend Internal ID Migration

## Decisions
- `BackendInstance.id` 固定为内部唯一标识，不再允许用户编辑。
- `BackendInstance.displayName` 用于用户可见展示，允许重名。
- 迁移入口在 `loadBackendsRegistry`，采用 `schemaVersion` 进行幂等控制。
- 托管本地后端旧 ID (`skillrunner-local`) 一次性收敛为 `local-skillrunner-backend`。
- backend manager 对托管后端（旧/新）统一隐藏。

## Migration Rules
1. 文档 `schemaVersion < 2` 时触发迁移。
2. 非托管条目且缺失 `displayName`：
   - `displayName = old.id`
   - `id = generateBackendInternalId(displayName, type)`
3. 托管旧 ID：`id = local-skillrunner-backend`。
4. 迁移后同步改写：
   - `workflowSettingsJson[*].backendId`
   - `taskDashboardHistoryJson.records[*].backendId`
5. 写回 `backendsConfigJson` 时统一写入 `schemaVersion=2`。

