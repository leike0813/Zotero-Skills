## Context

当前插件已有 Backend Manager（按 provider 管理 profile），但没有从插件内部进入 SkillRunner 管理面的能力。  
SkillRunner 后端现有 `/ui` 页面已经覆盖 Skills/Engines/Runs/Settings 等管理能力，且与 `/v1/management/*` 契约同步演进。

目标是在不复制后端前端代码的前提下，让插件内可直接使用该管理面。

## Goals / Non-Goals

**Goals**

- 在 Backend Manager 的 SkillRunner 行新增“进入管理页面”动作。
- 点击动作时使用行内当前编辑值（含未保存状态）计算 `${baseUrl}/ui`。
- 在 Zotero 对话框中内嵌后端原生管理页。
- 失败时给出稳定诊断（baseUrl 缺失/非法、页面打开失败）。

**Non-Goals**

- 不在插件侧复刻后端管理 UI。
- 不修改 provider 执行鉴权模型与请求头逻辑。
- 不新增 backend profile 的 Basic Auth 用户名/密码存储字段。

## Decisions

### Decision 1: 采用原生 `/ui` 内嵌而非插件复刻

- 插件只实现入口与宿主容器；
- 页面内容、内部导航与交互由后端原生 UI 负责。

### Decision 2: 入口仅对 SkillRunner profile 显示

- SkillRunner 行动作列包含：`进入管理页面` + `移除`；
- generic-http 行仅保留 `移除`。

### Decision 3: 管理页 URL 解析使用行内实时值

- 点击入口时从当前行控件读取 `id/baseUrl`；
- baseUrl 合法时拼接 `${baseUrl}/ui`（去尾斜杠）；
- 非法时阻断并提示，不影响 backend 配置保存流程。

### Decision 4: Basic Auth 采用浏览器标准认证弹窗

- 不在插件配置中持久化 basic 凭据；
- 打开内嵌页面时由浏览器层处理认证弹窗与会话。

## Risks / Trade-offs

- [Risk] 后端 `/ui` 页面未来结构变化由后端控制，插件可控性较低。  
  -> Mitigation: 插件只绑定稳定入口 `/ui`，避免耦合内部 DOM。

- [Risk] 多窗口并发可能造成管理页实例焦点混淆。  
  -> Mitigation: 管理页宿主保持单实例复用，重复点击时聚焦已有窗口并刷新目标 URL。
