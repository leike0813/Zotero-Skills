## Why

当前 workflow 设置仍有“双配置（持久+临时 run-once）”链路，导致交互与执行语义复杂、用户认知成本高、测试覆盖碎片化。  
需要收敛为“单一持久配置 + 提交时一次性覆盖快照”，并统一到网页化入口与 Dashboard 视图。

## What Changes

- 重构 workflow 设置模型为单一持久配置源，移除 run-once 覆盖消费语义。
- 交互触发 workflow 时新增“提交前设置门禁”：
  - 有可配置项才弹页；
  - 无可配置项直接提交；
  - 缺少必需 backend profile 时阻止提交。
- 新增网页化提交前设置弹窗（Dashboard 风格）。
- Dashboard 新增顶层 `Workflow选项` tab，并提供 workflow 子 tab 的持久配置编辑（防抖保存）。
- 首选项 `openWorkflowSettings` 行为调整为打开 Dashboard 并定位 `Workflow选项` tab。
- 同一批次拆分出的多个 job 强制使用同一份提交配置快照。
- 第二轮稳定性收敛：
  - `Workflow选项` 页停止周期性全量刷新导致的输入失焦；
  - 数值输入控件去除 spinbox 依赖并增加字段级校验；
  - SkillRunner runtime options 按 `skillrunner_mode` 做可见性/载荷门禁；
  - 提交弹窗移除框架冗余取消按钮并采用紧凑尺寸；
  - workflow 相关文案统一到“默认配置 / default settings”语义。

## Capabilities

### New Capabilities

- `workflow-settings-single-source-submit-flow`: 定义单一持久配置源、提交前设置门禁、网页化设置入口与批次配置不变量。

### Modified Capabilities

- `workflow-settings-run-once-default-sync`: 删除 run-once 默认值同步语义，迁移到“提交时一次性覆盖快照”。
- `workflow-settings-domain-decoupling`: 执行设置解析从“持久+run-once”调整为“持久+可选一次性 override”。
- `workflow-settings-per-workflow-page`: 首选项入口改为 Dashboard `Workflow选项` tab 路由；交互触发入口保持按 workflow 打开专属设置页。

## Impact

- 影响模块：
  - `src/modules/workflowSettings.ts`
  - `src/modules/workflowExecute.ts`
  - `src/modules/workflowExecution/preparationSeam.ts`
  - `src/modules/workflowMenu.ts`
  - `src/modules/taskManagerDialog.ts`
  - `src/hooks.ts`
- 新增网页资源：
  - `addon/content/dashboard/workflow-settings-dialog.html/.css/.js`
- 影响测试：
  - `test/ui/35-workflow-settings-execution.test.ts`
  - Dashboard snapshot / UI bridge 相关用例
- 文档新增：
  - `doc/components/workflow-settings-single-source-submit-flow-ssot.md`
