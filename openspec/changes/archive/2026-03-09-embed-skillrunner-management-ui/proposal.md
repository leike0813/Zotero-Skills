## Why

SkillRunner 后端已经提供完整的管理 UI（`/ui`）与管理 API（`/v1/management/*`），  
插件侧当前仅有 backend profile 编辑能力，缺少直接进入管理面的入口，导致运维与排障链路割裂。

为避免插件和后端双端重复维护管理前端，本 change 采用“插件内嵌后端原生 `/ui`”方案：

- 在 Backend Manager 的 SkillRunner profile 行提供管理页入口；
- 在 Zotero 内打开嵌入式管理窗口，直接承载后端原生管理 UI。

## What Changes

- 新增 `embed-skillrunner-management-ui` change 工件与 delta specs。
- Backend Manager 增加 SkillRunner 专属动作：`进入管理页面`。
- 新增管理页宿主模块：在 Zotero 对话框中内嵌 `${baseUrl}/ui`。
- 管理页 Basic Auth 采用浏览器标准认证弹窗输入，不在插件配置中持久化用户名/密码。
- 更新开发文档，明确该能力边界与鉴权行为。

## Capabilities

### New Capabilities

- `skillrunner-management-page`: 插件可在 Zotero 内承载后端原生 SkillRunner 管理 UI。

### Modified Capabilities

- `backend-manager-ui`: SkillRunner profile 行新增管理页入口动作。

## Impact

- 不改 provider 执行链与 request contract；
- 不新增 backend profile 的鉴权字段（仅沿用现有 `none/bearer` 供执行链使用）；
- 管理页能力由后端 `/ui` 提供，插件仅负责入口与容器承载。
