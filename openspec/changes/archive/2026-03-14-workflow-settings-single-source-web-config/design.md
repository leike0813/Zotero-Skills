## Context

当前 workflow 设置链路由持久配置与 run-once 配置并行驱动，执行时存在 consume/reset 语义，导致：

- 执行入口对配置优先级理解困难；
- UI 需要维护双草稿和双保存动作；
- Dashboard 无统一持久化编辑入口。

同时，用户已明确要求：

- 交互提交前必须有 workflow 专属设置页（仅对可配置 workflow）。
- Dashboard 必须提供统一 `Workflow选项` 配置页。
- batch 拆分任务必须共享同一提交配置快照。

## Goals / Non-Goals

**Goals:**

- 建立单一持久配置源（SSOT）。
- 交互入口提交前设置门禁稳定可测。
- 提供网页化设置弹窗与 Dashboard Workflow选项页。
- 保证 batch 级配置一致性不变量。

**Non-Goals:**

- 不重写旧的 `workflowSettingsDialog.ts` 页面（保留兼容，停止主路径使用）。
- 不改变 workflow build/apply 协议与 provider 接口。
- 不在本变更中做所有历史 key 清理。

## Decisions

### Decision 1: 执行配置解析统一为“persisted + optional override”

- `workflowSettingsJson` 作为唯一持久配置源。
- 执行时只接受可选 `executionOptionsOverride`（本次提交快照），不再消费 run-once。
- run-once 旧 API 仅保留兼容壳，不参与执行语义。

### Decision 2: 交互入口强制设置门禁，非交互入口默认 bypass

- `executeWorkflowFromCurrentSelection` 增加 `requireSettingsGate` 与 `executionOptionsOverride`。
- 仅交互入口（当前右键菜单）设置 `requireSettingsGate=true`。
- 门禁判定规则：
  - 可配置项存在 => 弹页；
  - 无可配置项 => 直接执行；
  - 必需 profile 且无 profile => 弹页阻止确认。

### Decision 3: 可配置 workflow 判定采用“任一维度可编辑即成立”

- profile 维度：需要 backend profile 且 profile 数量不等于 1；
- workflow 参数 schema 非空；
- provider runtime option schema 非空。

### Decision 4: Dashboard 新增 Workflow选项顶层 tab

- 顶层 tab 与首页同级；
- 子 tab 仅展示“有可配置项”的 workflow；
- 表单变更防抖持久化，保存状态可观测（saving/saved/error）。

### Decision 5: batch 配置快照不变量

- 每次提交仅解析一次 execution context（含 override 合并）；
- 同批次所有 job 复用同一份解析结果。

### Decision 6: Workflow选项页必须避免周期刷新引发的焦点丢失

- Dashboard 的任务实时刷新仍保留；
- 但在 `workflow-options` tab 下，周期刷新与任务变更刷新不得触发表单重建；
- 仅初始化、显式切换与保存状态变化触发表单刷新。

### Decision 7: SkillRunner runtime options 按模式门禁

- `execution.skillrunner_mode=interactive`：
  - 显示/生效：`interactive_auto_reply`、`hard_timeout_seconds`
  - 隐藏/丢弃：`no_cache`
- `execution.skillrunner_mode=auto`：
  - 显示/生效：`no_cache`、`hard_timeout_seconds`
  - 隐藏/丢弃：`interactive_auto_reply`
- `hard_timeout_seconds` 仅接受正整数；空值表示后端默认。

### Decision 8: 提交弹窗采用紧凑容器并去除框架冗余按钮

- 弹窗仅保留页面内确认/取消按钮；
- 容器尺寸与间距独立于 Dashboard 主页面，采用更紧凑布局；
- 两个入口（提交弹窗 / Dashboard 选项页）复用同一字段模型。

## Risks / Trade-offs

- [Risk] 旧 run-once 测试/调用仍存在，可能造成语义误解  
  → Mitigation: 保留兼容 API 但测试迁移到新语义，文档标注 deprecated。

- [Risk] Dashboard 与提交弹窗存在表单渲染重复代码  
  → Mitigation: 先统一 host 描述模型与字段契约；后续再抽前端共享渲染模块。

- [Risk] 弹窗门禁导致交互路径新增一步  
  → Mitigation: 仅对可配置 workflow 生效，且默认“保存为默认配置”勾选。

## Migration Plan

1. 先落地单一持久配置 + execution override 执行链。
2. 接入交互入口提交前门禁与新网页弹窗。
3. 接入 Dashboard `Workflow选项` tab 与持久化动作。
4. 更新文案与测试，验证 `tsc + 定向测试 + openspec validate`。
5. 后续单独变更移除兼容壳（run-once API / 旧 dialog 页面）。

## Open Questions

- 本次不定义“旧 workflow settings 对话框”下线时间点，后续按兼容窗口单独决策。
